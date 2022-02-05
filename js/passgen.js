// GLOBALS
const NMIXES = 10 * 256     // number of spritz characters discarded per output character
const PRECHARS = 22         // number of characters required before any output
const CHARSPEROUTPUT = 3    // number of characters input per output character

let DICEWAREPOS = 1
let CONSONANTNEXT = true

// Spritz parameters
const S = Uint8Array.from({length: 256}, (_, idx) => idx)
let I = J = K = Z = 0       // Spritz registers
let W = 1                   // must be coprime to 256

const TEMPLATE = document.getElementById("template")
const TEXTAREA = document.getElementById("textarea")

let SELTMPL = TEMPLATE.selectedIndex  // track which template we're using
let NTMPL = 0                           // keeps track of where we are in the textarea
let CHARCOUNT = 0                       // allows multiple input characters per output character
let RANDARR = [0, 0]                    // array to hold random numbers for diceware

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
        const n = parseInt(fpHash.substring(i, i + 2), 16)    // Up to 4,080 mixes
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

    if (key.key.charCodeAt(0) % 2 === 1) {  // use key code as the Spritz register "W"
        W = key.key.charCodeAt(0)
    } else {
        W = 97 + key.key.charCodeAt(0)     // make odd (must be coprime to 256) and don't collide with another key code
    }

    // use current time of key down (milliseconds) as source randomness
    stir(Date.now() % 1000)

    CHARCOUNT++

    if (CHARCOUNT < PRECHARS) {
        TEXTAREA.value += "."
    } else if (CHARCOUNT === PRECHARS) {
        TEXTAREA.value += ".\n"
    } else if (CHARCOUNT % CHARSPEROUTPUT === 0) {
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
     * @param {Array} arr
     * @param {number} a
     * @param {number} b
     */
    var _swap = function(arr, a, b) {
        [S[a], S[b]] = [S[b], S[a]]
    }

    for (let i = 0; i < x; i++) {
        I = _madd(I, W)
        J = _madd(K, S[_madd(J, S[I])])
        K = _madd(K + I, S[J])

        _swap(S, I, J)

        Z = S[_madd(J, S[_madd(I, S[_madd(Z, K)])])]
    }

    return Z
}

/**
 * Uniformly extract a random number from Spritz.
 * @param {number} r - A maximum value
 * @returns {number} - A number between [0, r-1]
 */
function extract(r) {
    const min = 256 % r
    I = J = K = Z = 0
    W = 1

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

    if (NTMPL >= TEMPLATE.value.length) {
        TEXTAREA.value += "\n"
        NTMPL = 0
        CONSONANTNEXT = true
        return
    }

    if (SELTMPL != TEMPLATE.selectedIndex) {
        TEXTAREA.value += "\n"
        NTMPL = 0
        SELTMPL = TEMPLATE.selectedIndex
        return
    }

    TEXTAREA.scrollTop = TEXTAREA.scrollHeight
    tmplChar = TEMPLATE.value[NTMPL]
    NTMPL++

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
        ch = extract(94) + 33       // 33 = '!'
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
    TEXTAREA.value += charIn
    CONSONANTNEXT = true
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

    if (CONSONANTNEXT) {
        syl += consonants[extract(consonants.length)]
        CONSONANTNEXT = false
    } else {
        syl += vowels[extract(vowels.length)]
        CONSONANTNEXT = true
    }

    TEXTAREA.value += syl
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

    if (DICEWAREPOS === 1) {
        RANDARR[0] = extract(128)               // 7 bits +
        DICEWAREPOS++
    } else {
        RANDARR[1] = extract(64)                // 6 bits =
        choice = RANDARR[0] << 6 | RANDARR[1]   // 13 bits =
        word = diceware8k[choice]               // 8192 possibilities
        TEXTAREA.value += word
        DICEWAREPOS--
    }

    return
}

/**
 * Clear the text area and reinitialize but carry over the existing Spritz state.
 * @returns undefined
 */
function clearPasswords() {
    TEXTAREA.value = ""
    CHARCOUNT = 0
    NTMPL = 0

    init()

    return
}

init()