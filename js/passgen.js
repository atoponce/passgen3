// GLOBALS
const PRECHARS = 22         // number of characters required before any output
const CHARSPEROUTPUT = 3    // number of characters input per output character

let CONSONANTNEXT = true

if ("spritzState" in localStorage) {
    Spritz.state = JSON.parse(localStorage.spritzState)
}

const TEMPLATE = document.getElementById("template")
const TEXTAREA = document.getElementById("textarea")
TEXTAREA.value = "Click here and start typing to generate passwords.\n"

let SELTMPL = TEMPLATE.selectedIndex    // track which template we're using
let NTMPL = 0                           // keeps track of where we are in the textarea
let CHARCOUNT = 0                       // allows multiple input characters per output character

/**
 * Initialize the Spritz state to a random state before keystrokes are entered.
 */
function init() {
    // use current time (precision = milliseconds) as source randomness
    const byteArr = []
    let now = Date.now()
    while (now > 0) {
        byteArr.push(now % 256)
        now = Math.floor(now / 256)
    }

    TEXTAREA.addEventListener("keydown", keyDown)
    TEXTAREA.addEventListener("keyup", keyUp)

    const aacs = new Uint32Array([0x09F91102, 0x9D74E35B, 0xD84156C5, 0x635688C0])
    const fp = generateFingerprint()                        // generate basic browser fingerprint
    const fpHash = SipHashDouble.hash_hex(aacs, fp)         // calculate 128-bit hash
    

    for (let i = 0; i < fpHash.length; i += 2) {
        let int = parseInt(fpHash.substring(i, i + 2), 16)
        byteArr.push(int)
    }

    // use current time as source randomness again
    now = Date.now()
    while (now > 0) {
        byteArr.push(now % 256)
        now = Math.floor(now / 256)
    }

    absorb(byteArr)
    absorbStop()

    randomScripps()
}

/**
 * Register a key press time in milliseconds and its value.
 * @param {Object} key - The keystroke
 * @returns true
 */
function keyDown(key) {
    const movementKeys = [" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageDown", "PageUp", "Home", "End", "Tab"]

    if (movementKeys.includes(key.key)) {
        key.preventDefault()                // prevent keys from scrolling the page
    }

    absorb([key.key.charCodeAt(0)])
    absorbStop()

    if (key.repeat) {
        key.preventDefault()                // prevent key repeat
        return true
    }

    // use current time of key down (milliseconds) as source randomness
    const byteArr = []
    let now = Date.now()
    while (now > 0) {
        byteArr.push(now % 256)
        now = Math.floor(now / 256)
    }

    absorb(byteArr)
    absorbStop()

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
    const byteArr = []

    let now = Date.now()
    while (now > 0) {
        byteArr.push(now % 256)
        now = Math.floor(now / 256)
    }

    absorb(byteArr)
    absorbStop()

    return true
}

/**
 * Uniformly extract a random number from Spritz.
 * @param {number} r - A maximum value
 * @returns {number} - A number between [0, r-1]
 */
function extract(r) {
    let q
    const min = 256 % r

    do {
        q = squeeze(1) << 8 | squeeze(1)
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
        if (NTMPL != 0) {
            TEXTAREA.value += "\n"
        }
        NTMPL = 0
        CHARCOUNT = PRECHARS
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
 * Build a Diweware passphrase.
 * Requires 2 * CHARSPEROUTPUT per word (and CHARSPEROUTPUT per space).
 * @returns undefined
 */
function addDiceware() {
    const rand = extract(8192)

    /**
     * Because every other set size < 256 characters in this project, we only
     * need 8 bits to build the password. However, there are 8,192 words in
     * this Diceware list, which requries 13 bits. As such, it should take
     * twice as much work to generate a random word.
     *
     * The template is "D D D D D D D D D D". Each "D" needs 6 characters of
     * input before the NTMPL pointer is advanced to " ". If NTMPL is pointing
     * at " ", only 3 characters are needed to advance it to the next "D".
     */
    if (CHARCOUNT % (CHARSPEROUTPUT * 3) === 0) {
        TEXTAREA.value += diceware8k[rand]
    } else if (CHARCOUNT % (CHARSPEROUTPUT * 3) === 6) {
        NTMPL -= 1
    }

    return
}

/**
 * Clear the text area and reinitialize but carry over the existing Spritz state.
 * @returns undefined
 */
function clearPasswords() {
    TEXTAREA.value = "Type here to generate your passwords.\n"
    CHARCOUNT = 0
    NTMPL = 0

    init()

    return
}

/** Save the current Spritz state to disk.  */
function saveEntropy() {
    localStorage.setItem("spritzState", JSON.stringify(Spritz.state))
}

/** Generate some random text for the user to type from the Scripps Spelling Bee word list. */
function randomScripps() {
    let rand
    const words = []
    
    for (let i = 0; i < 26; i++) {
        rand = extract(scripps.length)
        words.push(scripps[rand])
    }

    const scrippsText = "Typing these words provide at least 256 bits entropy:\n\n"
    document.getElementById("scripps").value = scrippsText + words.join(" ")
}

init()
