// GLOBALS
const NMIXES = 10 * 256     // number of spritz characters discarded per output character
const PRECHARS = 22         // number of characters required before any output
const CHARSPEROUTPUT = 3    // number of characters input per output character

let dicewarePos = 1
let consonantNext = true

// Spritz parameters
const S = Uint8Array.from({length: 256}, (_, i) => i)
let ii = jj = kk = zz = 0   // Spritz registers
let ww = 1                  // must be coprime to 256

const template = document.getElementById("template")
const textarea = document.getElementById("textarea")

let selTmpl = template.selectedIndex    // track which template we're using
let ntmpl = 0                           // keeps track of where we are in the textarea
let charCount = 0                       // allows multiple input characters per output character
let randArr = [0, 0]                    // array to hold random numbers for diceware

/**
 * Initialize the Spritz state to a random state before keystrokes are entered.
 */
function init() {
    // use current time (milliseconds) as source randomness
    stir(Date.now() % 1000)

    document.addEventListener("keydown", keyDown)
    document.addEventListener("keyup", keyUp)

    const fp = generateFingerprint()                        // generate basic browser fingerprint
    const fpHash = SipHashDouble.hash_hex("", fp)           // calculate 128-bit hash

    for (let i = 0; i < fpHash.length; i += 2) {
        let n = parseInt(fpHash.substring(i, i + 2), 16)    // Up to 4,080 mixes
        stir(n)
    }

    // use current time as source randomness again
    stir(Date.now() % 1000)

}

/**
 * Register a key press time in milliseconds and its value.
 * @param {Object} key - The keystroke
 * @returns true
 */
function keyDown(key) {
    if (key.key === " ") {
        key.preventDefault()                // prevent space from scrolling the page
    }

    if (key.key.charCodeAt(0) % 2 === 1) {  // use key code as the Spritz register "ww"
        ww = key.key.charCodeAt(0)
    } else {
        ww = 97 + key.key.charCodeAt(0)     // make odd (must be coprime to 256) and don't collide with another key code
    }

    // use current time of key down (milliseconds) as source randomness
    stir(Date.now() % 1000)

    charCount++

    if (charCount < PRECHARS) {
        textarea.value += "."
    } else if (charCount === PRECHARS) {
        textarea.value += ".\n"
    } else if (charCount % CHARSPEROUTPUT === 0) {
        addChar()
    }

    return true
}

/**
 * Register a key release time in milliseconds.
 * @param {Object} key - The keystroke
 * @returns true
 */
function keyUp(key) {
    // use current time of key up (milliseconds) as source randomness
    stir(Date.now() % 1000)

    return true
}

/**
 * Maintain a pool of randomness using the Spritz algorithm.
 * @param {number} x - The number of mixing operations
 * @returns {number} - A random number from Spritz
 */
function stir(x) {
    /**
     * Returns the sum modulo 256 of a and b
     * @param {number} a
     * @param {number} b
     * @returns {number} - Sum of a and b
     */
    var _madd = function(a, b) {
        return (a + b) % 256
    }

    /**
     * Swap array elements a and b
     * @param {number} a
     * @param {number} b
     */
    var _swap = function(a, b) {
        let tmp = S[a]
        S[a] = S[b]
        S[b] = tmp
    }

    for (let i = 0; i < x; i++) {
        ii = _madd(ii, ww)
        jj = _madd(kk, S[_madd(jj, S[ii])])
        kk = _madd(kk + ii, S[jj])

        _swap(S[ii], S[jj])

        zz = S[_madd(jj, S[_madd(ii, S[_madd(zz, kk)])])]
    }

    return zz
}

/**
 * Uniformly extract a random number from Spritz.
 * @param {number} r - A maximum value
 * @returns {number} - A number between [0, r-1]
 */
function extract(r) {
    let min = 256 % r
    ii = jj = kk = zz = 0
    ww = 1

    stir(NMIXES)        // we can afford a lot of mixing

    do {
        q = stir(1)
    } while (q < min)   // avoid biased choice

    return (q % r)
}

/**
 * Generate a character or word based on the extracted random number from Spritz.
 * @returns undefined
 */
function addChar() {
    let ch = 0
    let tmplChar
    let charIn

    if (ntmpl >= template.value.length) {
        textarea.value += "\n"
        ntmpl = 0
        consonantNext = true
        return
    }

    if (selTmpl != template.selectedIndex) {
        textarea.value += "\n"
        ntmpl = 0
        selTmpl = template.selectedIndex
        return
    }

    textarea.scrollTop = textarea.scrollHeight
    tmplChar = template.value[ntmpl]
    ntmpl++

    if (tmplChar === " ") {
        ch = 32
    } else if (tmplChar === "A") {  // Random letter [[:upper:]]]
        ch = extract(26) + 65       // 65 = 'A'
    } else if (tmplChar === "C") {  // Random alphanumeric [[:digit:][:upper:]]
        ch = extract(36)
        if (ch < 10) {
            ch += 48                // 48 = '0'
        } else {
            ch += 55                // 55 + 10 = 'A'
        }
    } else if (tmplChar === "D") {  // Random Diceware word
        addDiceware()
        return
    } else if (tmplChar === "H") {  // Random hexadecimal [[:xdigit:]]
        ch = extract(16)
        if (ch < 10) {
            ch += 48                // 48 = '0'
        } else {
            ch += 55                // 55 + 10 = 'A'
        }
    } else if (tmplChar === "L") {  // Random alphanumeric upper or lower case [[:digit:][:upper:][:lower:]]
        ch = extract(62)
        if (ch < 10) {
            ch += 48                // 48 = '0'
        } else if (ch < 36) {
            ch += 55                // 55 + 10 = 'A'
        } else {
            ch += 61                // 61 + 36 = 'a'
        }
    } else if (tmplChar === "M") {  // Random 7-bit ASCII graphical [[:graph:]]]
        ch = extract(94)
        ch += 33                    // 33 = '!'
    } else if (tmplChar === "S") {  // random syllable (see addSyllable below)
        addSyllable()
        return
    } else if (tmplChar === "6") {  // Random dice throw [1-6]
        ch = extract(6) + 49        // 49 = '1'
    } else if (tmplChar === "9") {  // Random decimal digit [[:digit:]]
        ch = extract(10) + 48       // 48 = '0'
    } else {
        return
    }

    charIn = String.fromCharCode(ch)
    textarea.value += charIn
    consonantNext = true
    ch = 0
    charIn = null
    return
}

/**
 * Build a pronounceable password alternating consonant and vowel.
 * @returns undefined
 */
function addSyllable() {
    let syl = ""
    const vowels = "aiou"
    const consonants = "bdfghjklmnprstvz"

    if (consonantNext) {
        syl += consonants[extract(consonants.length)]
        consonantNext = false
    } else {
        syl += vowels[extract(vowels.length)]
        consonantNext = true
    }

    textarea.value += syl
    syl = ""

    return
}

/**
 * Build a Diweware passphrase. Requires 2 * CHARSPEROUTPUT per word.
 * @returns undefined
 */
function addDiceware() {
    let word
    let choice

    if (dicewarePos === 1) {
        randArr[0] = extract(128)               // 7 bits +
        dicewarePos++
    } else {
        randArr[1] = extract(64)                // 6 bits =
        choice = randArr[0] << 6 | randArr[1]   // 13 bits
        word = diceware8k[choice]               // (8192 possibilities)
        textarea.value += word
        dicewarePos--
    }

    return
}

init()