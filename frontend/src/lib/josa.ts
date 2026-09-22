// 앞 단어의 받침에 맞춰 조사를 고른다. 한글이 아닌 끝 글자(숫자·영문)는 받침 없음으로 본다.
type Pair = '을/를' | '은/는' | '이/가' | '과/와'

export function josa(word: string, pair: Pair): string {
  const [withFinal, withoutFinal] = pair.split('/')
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${word}${hasFinal ? withFinal : withoutFinal}`
}
