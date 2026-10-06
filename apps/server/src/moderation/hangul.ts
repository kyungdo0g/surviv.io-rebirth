// Hangul helpers of the name filter (M8): conjoining jamo to compatibility jamo, and recomposition of separately typed
// compatibility jamo into syllables ("ㅅㅣㅂㅏㄹ" -> "시발"), so names written jamo by jamo to dodge a filter match the
// same entries as their syllables. Unicode Hangul syllable arithmetic: 0xAC00 + (L * 21 + V) * 28 + T.

/** Compatibility jamo of the 19 initial consonants, in syllable order. */
const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
/** Compatibility jamo of the 21 vowels, in syllable order. */
const VOWELS = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
/** Compatibility jamo of the 27 final consonants (index + 1 is T). */
const FINALS = "ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ";

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;

export function isHangulSyllable(cp: number): boolean {
    return cp >= SYLLABLE_BASE && cp <= SYLLABLE_LAST;
}

/** Compatibility jamo block (ㄱ..ㆎ). */
export function isCompatJamo(cp: number): boolean {
    return cp >= 0x3131 && cp <= 0x318e;
}

/** Conjoining jamo block (what NFD produces). */
export function isConjoiningJamo(cp: number): boolean {
    return cp >= 0x1100 && cp <= 0x11ff;
}

/** A conjoining jamo as its compatibility jamo ("" for archaic ones without one). */
export function conjoiningToCompat(cp: number): string {
    if (cp >= 0x1100 && cp <= 0x1112) return INITIALS[cp - 0x1100];
    if (cp >= 0x1161 && cp <= 0x1175) return VOWELS[cp - 0x1161];
    if (cp >= 0x11a8 && cp <= 0x11c2) return FINALS[cp - 0x11a8];
    return "";
}

export function containsHangul(text: string): boolean {
    for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        if (isHangulSyllable(cp) || isCompatJamo(cp)) return true;
    }
    return false;
}

/** Keeps Hangul syllables and compatibility jamo only. */
export function hangulOnly(text: string): string {
    let out = "";
    for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        if (isHangulSyllable(cp) || isCompatJamo(cp)) out += ch;
    }
    return out;
}

/**
 * Composes runs of compatibility jamo into syllables the way a Korean IME does: an initial consonant followed by a
 * vowel starts a syllable, which takes the next consonant as its final unless a vowel follows that consonant.
 * Syllables and other characters pass through.
 */
export function recomposeJamo(text: string): string {
    const chars = [...text];
    let out = "";
    let i = 0;
    while (i < chars.length) {
        const l = INITIALS.indexOf(chars[i]);
        const v = i + 1 < chars.length ? VOWELS.indexOf(chars[i + 1]) : -1;
        if (l < 0 || v < 0) {
            out += chars[i];
            i++;
            continue;
        }
        let t = 0;
        let next = i + 2;
        if (next < chars.length) {
            const f = FINALS.indexOf(chars[next]);
            const vowelAfter = next + 1 < chars.length && VOWELS.includes(chars[next + 1]);
            if (f >= 0 && !vowelAfter) {
                t = f + 1;
                next++;
            }
        }
        out += String.fromCodePoint(SYLLABLE_BASE + (l * 21 + v) * 28 + t);
        i = next;
    }
    return out;
}
