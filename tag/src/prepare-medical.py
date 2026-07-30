"""심평원 전국 병·의원·약국 스냅샷에서 부산 의료시설을 정규화한다.

원본은 건강보험심사평가원 「전국 병의원 및 약국 현황」 ZIP이다.
저장소에는 용량이 큰 전국 원본 대신 이 스크립트로 만든 부산 정규화본만 둔다.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import hashlib
import io
import json
import math
import re
import zipfile
from collections.abc import Callable
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = ROOT / "tag" / "data" / "external" / "raw" / "hira_medical_202606.zip"
DEFAULT_OUTPUT = (
    ROOT / "tag" / "data" / "external" / "busan_medical_facilities_20260630.json"
)

OFFICIAL_SOURCE_URL = (
    "https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925"
)
PUBLIC_DATA_PORTAL_URL = "https://www.data.go.kr/data/15051059/fileData.do"
SNAPSHOT_DATE = "2026-06-30"
PRIMARY_CARE_TYPES = {"의원", "보건소", "보건지소", "보건진료소"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="심평원 전국 병의원 및 약국 현황 ZIP",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="부산 의료시설 정규화 JSON",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


XLSX_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def column_index(reference: str) -> int:
    match = re.match(r"([A-Z]+)", reference)
    if not match:
        raise ValueError(f"잘못된 XLSX 셀 주소: {reference}")
    value = 0
    for letter in match.group(1):
        value = value * 26 + ord(letter) - ord("A") + 1
    return value - 1


def xlsx_rows(
    workbook_bytes: bytes,
    keep: Callable[[dict[str, str]], bool] | None = None,
) -> tuple[list[str], list[dict[str, str]]]:
    with zipfile.ZipFile(io.BytesIO(workbook_bytes)) as workbook:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(
                    text.text or ""
                    for text in item.iter(f"{{{XLSX_NS}}}t")
                )
                for item in root.findall(f"{{{XLSX_NS}}}si")
            ]

        sheet_names = sorted(
            name
            for name in workbook.namelist()
            if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)
        )
        if not sheet_names:
            raise ValueError("XLSX 워크시트를 찾을 수 없습니다.")

        headers: list[str] = []
        records: list[dict[str, str]] = []
        with workbook.open(sheet_names[0]) as sheet:
            for _, row in ElementTree.iterparse(sheet, events=("end",)):
                if row.tag != f"{{{XLSX_NS}}}row":
                    continue
                values: dict[int, str] = {}
                for cell in row.findall(f"{{{XLSX_NS}}}c"):
                    index = column_index(cell.attrib.get("r", ""))
                    cell_type = cell.attrib.get("t")
                    if cell_type == "inlineStr":
                        value = "".join(
                            text.text or ""
                            for text in cell.iter(f"{{{XLSX_NS}}}t")
                        )
                    else:
                        node = cell.find(f"{{{XLSX_NS}}}v")
                        raw = "" if node is None or node.text is None else node.text
                        value = (
                            shared_strings[int(raw)]
                            if cell_type == "s" and raw
                            else raw
                        )
                    values[index] = value
                if not headers:
                    last = max(values, default=-1)
                    headers = [values.get(index, "").strip() for index in range(last + 1)]
                else:
                    record = {
                        header: values.get(index, "")
                        for index, header in enumerate(headers)
                        if header
                    }
                    if keep is None or keep(record):
                        records.append(record)
                row.clear()
        return headers, records


def workbook_from_zip(
    archive: zipfile.ZipFile,
    prefix: str,
    keep: Callable[[dict[str, str]], bool] | None = None,
) -> tuple[list[str], list[dict[str, str]]]:
    def decoded_name(member: zipfile.ZipInfo) -> str:
        if member.flag_bits & 0x800:
            return member.filename
        try:
            return member.filename.encode("cp437").decode("cp949")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return member.filename

    members = [
        member
        for member in archive.infolist()
        if Path(decoded_name(member)).name.startswith(prefix)
        and decoded_name(member).lower().endswith(".xlsx")
    ]
    if len(members) != 1:
        raise ValueError(f"{prefix} XLSX를 하나 찾을 수 없습니다: {len(members)}개")
    return xlsx_rows(archive.read(members[0]), keep)


def clean(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def as_number(value: object) -> float | None:
    if value is None or clean(value) == "":
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def as_integer(value: object) -> int | None:
    number = as_number(value)
    return int(number) if number is not None else None


def as_date(value: object) -> str | None:
    text = clean(value)
    if not text:
        return None
    try:
        serial = float(text)
        return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()
    except ValueError:
        return text[:10]


def public_id(encrypted_provider_id: object) -> str:
    return hashlib.sha256(clean(encrypted_provider_id).encode("utf-8")).hexdigest()[:20]


def facility_record(row: dict[str, str], kind: str) -> dict[str, object]:
    return {
        "id": public_id(row["암호화요양기호"]),
        "kind": kind,
        "name": clean(row["요양기관명"]),
        "institutionType": clean(row["종별코드명"]),
        "institutionTypeCode": clean(row["종별코드"]),
        "district": clean(row["시군구코드명"]).removeprefix("부산"),
        "dong": clean(row["읍면동"]),
        "address": clean(row["주소"]),
        "lat": as_number(row["좌표(Y)"]),
        "lng": as_number(row["좌표(X)"]),
        "openedDate": as_date(row.get("개설일자")),
        "doctorCount": as_integer(row.get("총의사수")),
        "referenceDate": SNAPSHOT_DATE,
        "source": "HIRA",
    }


def validate_columns(
    columns: list[str], required: set[str], source_name: str
) -> None:
    missing = required - set(columns)
    if missing:
        raise ValueError(f"{source_name} 필수 컬럼 누락: {sorted(missing)}")


def validate_coordinates(records: list[dict[str, object]]) -> None:
    missing = [
        record["name"]
        for record in records
        if record["lat"] is None or record["lng"] is None
    ]
    if missing:
        raise ValueError(f"선정 의료시설 좌표 결측 {len(missing)}건: {missing[:5]}")
    outside = [
        record
        for record in records
        if not (
            34.8 <= float(record["lat"]) <= 35.8
            and 128.5 <= float(record["lng"]) <= 129.5
        )
    ]
    if outside:
        raise ValueError(
            "부산권 좌표 범위를 벗어난 의료시설: "
            + ", ".join(
                f"{record['name']}({record['lat']},{record['lng']})"
                for record in outside[:5]
            )
        )


def main() -> None:
    args = parse_args()
    if not args.source.exists():
        raise FileNotFoundError(
            f"심평원 ZIP이 없습니다: {args.source}\n"
            f"공식 페이지에서 2026.6 파일을 내려받아 --source로 지정하세요: "
            f"{OFFICIAL_SOURCE_URL}"
        )

    with zipfile.ZipFile(args.source) as archive:
        hospital_columns, busan_hospitals = workbook_from_zip(
            archive, "1.", lambda row: clean(row.get("시도코드명")) == "부산"
        )
        pharmacy_columns, busan_pharmacies = workbook_from_zip(
            archive, "2.", lambda row: clean(row.get("시도코드명")) == "부산"
        )
        special_columns, emergency_services = workbook_from_zip(
            archive,
            "10.",
            lambda row: clean(row.get("검색코드명")) == "응급의료기관",
        )

    common_required = {
        "암호화요양기호",
        "요양기관명",
        "종별코드",
        "종별코드명",
        "시도코드명",
        "시군구코드명",
        "읍면동",
        "주소",
        "좌표(X)",
        "좌표(Y)",
    }
    validate_columns(
        hospital_columns, common_required | {"총의사수"}, "병원정보서비스"
    )
    validate_columns(pharmacy_columns, common_required, "약국정보서비스")
    validate_columns(
        special_columns,
        {"암호화요양기호", "검색코드", "검색코드명"},
        "특수진료정보서비스",
    )

    primary_rows = [
        row
        for row in busan_hospitals
        if clean(row.get("종별코드명")) in PRIMARY_CARE_TYPES
    ]
    emergency_ids = set(
        clean(row.get("암호화요양기호")) for row in emergency_services
    )
    emergency_rows = [
        row
        for row in busan_hospitals
        if clean(row.get("암호화요양기호")) in emergency_ids
    ]

    records = [
        *(facility_record(row, "primary_care") for row in primary_rows),
        *(facility_record(row, "pharmacy") for row in busan_pharmacies),
        *(facility_record(row, "emergency") for row in emergency_rows),
    ]
    records = list(
        {
            (str(record["kind"]), str(record["id"])): record for record in records
        }.values()
    )
    records.sort(key=lambda row: (str(row["kind"]), str(row["name"]), str(row["id"])))
    validate_coordinates(records)

    counts = {
        kind: sum(record["kind"] == kind for record in records)
        for kind in ("primary_care", "pharmacy", "emergency")
    }
    output = {
        "metadata": {
            "schemaVersion": 1,
            "spatialTarget": "부산광역시 전체",
            "sourceName": "건강보험심사평가원_전국 병의원 및 약국 현황_20260630",
            "sourceUrl": OFFICIAL_SOURCE_URL,
            "publicDataPortalUrl": PUBLIC_DATA_PORTAL_URL,
            "sourceSnapshotDate": SNAPSHOT_DATE,
            "sourceZipSha256": sha256(args.source),
            "sourceAttachmentId": "326801",
            "sourceLicense": "공공누리 제1유형(출처표시)",
            "coordinateInterpretation": "좌표(X)=경도, 좌표(Y)=위도; 부산권 WGS84 범위 검증",
            "primaryCareTypes": sorted(PRIMARY_CARE_TYPES),
            "emergencyRule": "특수진료정보서비스 검색코드명='응급의료기관'",
            "counts": counts,
        },
        "facilities": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                **counts,
                "totalRecords": len(records),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
