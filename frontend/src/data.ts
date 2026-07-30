// Static content for the whole app. Anything requiring navigation or state
// (onClick handlers) is built inside the screens; this file holds pure data.

import type { MyMenu, SelKey, Tag } from './types'

export const baseTags: Tag[] = [
  { id: 'cafe', label: '카페', icon: 'local_cafe' },
  { id: 'gym', label: '헬스장', icon: 'fitness_center' },
  { id: 'cvs', label: '편의점', icon: 'storefront' },
  { id: 'culture', label: '문화·예술', icon: 'palette' },
  { id: 'quiet', label: '조용한 주거', icon: 'cottage' },
  { id: 'shop', label: '쇼핑·상권', icon: 'shopping_bag' },
  { id: 'transit', label: '대중교통', icon: 'directions_bus' },
  { id: 'park', label: '공원·자연', icon: 'park' },
]

export const byTagId: Record<string, Tag> = Object.fromEntries(
  baseTags.map((t): [string, Tag] => [t.id, t]),
)

// [level, label] for tag importance weighting
export const wLevels: [number, string][] = [
  [1, '참고만'],
  [2, '보통'],
  [3, '매우 중요'],
]

// 주택 목록·상세는 API 레이어(src/api/housings.ts)로 이동 — MSW가 generated/housings.json을 서빙.
// 아래는 서버데이터가 아닌 정적 화면 콘텐츠.

// Setup selects: [stateKey, label, options]
export const selDef: [SelKey, string, string[]][] = [
  [
    'rentType',
    '공급 유형',
    [
      '행복주택',
      '통합공공임대',
      '국민임대',
      '영구임대',
      '청년매입임대',
      '전세임대',
    ],
  ],
  [
    'buildYear',
    '준공연도',
    ['5년 이내', '10년 이내', '15년 이내', '제한 없음'],
  ],
  [
    'area',
    '전용면적',
    ['~ 30m² (원룸)', '30 ~ 40m²', '40 ~ 60m²', '60m² 이상', '전체'],
  ],
]

// 부산 구/군 고정 집합(16). 지역 칩은 데이터 유무와 무관하게 전 구/군을 항상 노출한다.
export const busanDistricts: string[] = [
  '강서구',
  '금정구',
  '기장군',
  '남구',
  '동구',
  '동래구',
  '부산진구',
  '북구',
  '사상구',
  '사하구',
  '서구',
  '수영구',
  '연제구',
  '영도구',
  '중구',
  '해운대구',
]

export const roomOpts: string[] = ['원룸', '1.5룸', '투룸', '쓰리룸+']
export const buildOpts: string[] = [
  '아파트',
  '오피스텔',
  '빌라/연립',
  '도시형생활주택',
]

export const advancedSelects: { label: string; options: string[] }[] = [
  {
    label: '소득구간',
    options: ['제한 없음', '1분위', '2분위', '3분위', '4분위 이상'],
  },
  {
    label: '공급계층',
    options: ['일반공급', '신혼부부', '청년', '고령자', '장애인'],
  },
  {
    label: '우선공급',
    options: ['해당 없음', '다자녀', '기초생활수급', '국가유공자'],
  },
]

// Detail tabs: [id, label]
export const detailTabDefs: [string, string][] = [
  ['basic', '기본정보'],
  ['cost', '비용'],
  ['infra', '주변 인프라'],
  ['transit', '교통'],
]

export const detailRows: Record<string, [string, string][]> = {
  basic: [
    ['임대유형', '행복주택'],
    ['세대수', '120세대'],
    ['주택형', '21A'],
    ['준공일', '2022.03.15'],
    ['전용면적', '21.26m²'],
    ['승강기', '있음'],
    ['주차대수', '80대'],
    ['층수', '지상 15층'],
  ],
  cost: [
    ['보증금', '3,000만원'],
    ['월 임대료', '18만원'],
    ['관리비', '약 7만원'],
    ['보증금 대출', '최대 80%'],
    ['계약기간', '2년'],
    ['갱신 가능', '2회'],
  ],
  infra: [
    ['카페', '32곳 · 도보 5분'],
    ['헬스장', '18곳 · 도보 8분'],
    ['편의점', '25곳 · 도보 3분'],
    ['공원', '민락수변공원 400m'],
    ['대형마트', '2곳 · 차량 6분'],
    ['병원', '14곳 · 도보 10분'],
  ],
  transit: [
    ['지하철', '수영역 도보 9분'],
    ['버스 정류장', '도보 2분'],
    ['버스 노선', '12개 노선'],
    ['광안대교', '차량 7분'],
    ['서면', '대중교통 25분'],
    ['부산역', '대중교통 35분'],
  ],
}

// Social login buttons
export const socialLoginsData: {
  label: string
  icon: string
  bg: string
  color: string
  border: string
}[] = [
  {
    label: '카카오로 계속하기',
    icon: 'chat_bubble',
    bg: '#FEE500',
    color: '#3B1E1E',
    border: 'none',
  },
]

// Mypage 메뉴 — 상위 그룹으로 묶음(내 정보 / 설정 / 지원). `to`가 있으면 이동, 없으면 준비중.
export const myMenuGroups: { title: string; items: MyMenu[] }[] = [
  {
    title: '내 정보',
    items: [
      { icon: 'badge', label: '청약 자격 정보', sub: '3분위 · 무주택 4년' },
      {
        icon: 'assignment_turned_in',
        label: '청약 신청 내역',
        sub: '1건 진행중',
      },
      { icon: 'compare_arrows', label: '취향 다시 학습', sub: '', to: 'swipe' },
    ],
  },
  {
    title: '설정',
    items: [
      { icon: 'notifications', label: '알림 설정', sub: '' },
      { icon: 'lock', label: '계정·보안', sub: '' },
      { icon: 'contrast', label: '화면 설정', sub: '라이트' },
      { icon: 'shield_person', label: '개인정보 설정', sub: '' },
    ],
  },
  {
    title: '지원',
    items: [
      { icon: 'support_agent', label: '고객센터 · 1:1 문의', sub: '' },
      { icon: 'description', label: '이용약관 · 정책', sub: '' },
    ],
  },
]

export const myQual: { label: string; value: string }[] = [
  { label: '소득 분위', value: '3분위' },
  { label: '무주택 기간', value: '4년' },
  { label: '청약통장', value: '가입 2년' },
  { label: '거주지', value: '부산 수영구' },
]

export const footerLinks: string[] = [
  '이용약관',
  '개인정보처리방침',
  '이메일무단수집거부',
  '고객센터',
  '오시는 길',
]

export const aiExamples: string[] = [
  '수영구 원룸, 보증금 2천만원 이하',
  '해운대 투룸, 신축이면 좋아요',
  '카페 가까운 원룸, 보증금 3천 이하',
]
