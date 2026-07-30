"""KRIC 전체 도시철도 역사 XLSX에서 부산 철도망만 정규화한다."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "tag" / "data" / "external"
SOURCE = DATA_DIR / "all_metro_20260630.xlsx"
OUTPUT = DATA_DIR / "busan_rail_stations.json"


def clean(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


frame = pd.read_excel(SOURCE, sheet_name="표준데이터 역사")
metro = frame["운영기관명"].eq("부산광역시 부산교통공사")
bgl = frame["운영기관명"].eq("부산-김해경전철㈜")
donghae = frame["운영기관명"].eq("한국철도공사") & frame["노선명"].eq("동해선")
busan = frame.loc[metro | bgl | donghae].copy()


def mode_for(row: pd.Series) -> str:
    if row["운영기관명"] == "부산광역시 부산교통공사":
        return "metro"
    if row["운영기관명"] == "부산-김해경전철㈜":
        return "bgl"
    return "donghae"


records: list[dict[str, object]] = []
for _, row in busan.iterrows():
    lat = float(row["역위도"])
    lng = float(row["역경도"])
    if not (34.8 <= lat <= 35.8 and 128.5 <= lng <= 129.5):
        raise ValueError(f"부산권 좌표 범위를 벗어난 역사: {row['역사명']} {lat},{lng}")
    records.append(
        {
            "stationNumber": clean(row["역번호"]),
            "name": clean(row["역사명"]),
            "lineNumber": clean(row["노선번호"]),
            "lineName": clean(row["노선명"]),
            "mode": mode_for(row),
            "transfer": clean(row["환승역구분"]) == "환승역",
            "transferLineNumbers": [
                item.strip()
                for item in clean(row["환승노선번호"]).split(",")
                if item.strip()
            ],
            "transferLineNames": [
                item.strip()
                for item in clean(row["환승노선명"]).split(",")
                if item.strip()
            ],
            "lat": lat,
            "lng": lng,
            "operator": clean(row["운영기관명"]),
            "address": clean(row["역사도로명주소"]),
            "referenceDate": clean(row["데이터기준일자"]),
        }
    )

records.sort(key=lambda row: (str(row["mode"]), str(row["lineName"]), str(row["stationNumber"])))
OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(
    json.dumps(
        {
            "output": str(OUTPUT),
            "records": len(records),
            "metro": sum(row["mode"] == "metro" for row in records),
            "donghae": sum(row["mode"] == "donghae" for row in records),
            "bgl": sum(row["mode"] == "bgl" for row in records),
        },
        ensure_ascii=False,
    )
)
