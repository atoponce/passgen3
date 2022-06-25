// GLOBALS
const PRECHARS = 64                     // number of characters required before any output (80 bits)
const ENTROPYPERCHAR = 2                // amount of entropy per character
const ENTROPY = new Uint32Array(1)      // The entropy bucket for tracking what entropy has been used and what is available
const TEMPLATE = document.getElementById("template")
const TEXTAREA = document.getElementById("textarea")

let NTMPL = 0                           // keeps track of where we are in the textarea
let CHARCOUNT = 0                       // allows multiple input characters per output character
let SELTMPL = TEMPLATE.selectedIndex    // track which template we're using

TEXTAREA.value = "Type here to generate your passwords.\n"

/**
 * Initialize the Spritz state to a random state before keystrokes are entered.
 */
function init() {
    const aacs = new Uint32Array([0x09F91102, 0x9D74E35B, 0xD84156C5, 0x635688C0])
    const fp = generateFingerprint()                        // generate basic browser fingerprint
    const fpHash = SipHashDouble.hash_hex(aacs, fp)         // calculate 128-bit hash

    TEXTAREA.addEventListener("keydown", keyDown)
    TEXTAREA.addEventListener("keyup", keyUp)

    if ("spritzState" in localStorage) {
        Spritz.state = JSON.parse(localStorage.spritzState)
    }

    // use current time (precision = milliseconds) as source randomness
    let byteArr = timeToByteArray(Date.now())

    absorb(byteArr)
    absorbStop()

    byteArr = []

    for (let i = 0; i < fpHash.length; i += 2) {
        let int = parseInt(fpHash.substring(i, i + 2), 16)
        byteArr.push(int)
    }

    absorb(byteArr)
    absorbStop()

    byteArr = timeToByteArray(Date.now())

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
    const byteArr = timeToByteArray(Date.now())

    absorb(byteArr)
    absorbStop()

    CHARCOUNT++

    if (CHARCOUNT < PRECHARS) {
        TEXTAREA.value += "."
    } else if (CHARCOUNT === PRECHARS) {
        TEXTAREA.value += ".\n"
    } else {
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
    const byteArr = timeToByteArray(Date.now())

    absorb(byteArr)
    absorbStop()

    return true
}

/**
 * Convert a time in milliseconds to an 8-bit byte array.
 * @param {number} time - The time in milliseconds
 * @returns {Array} - An array of bytes representing the time
 */
function timeToByteArray(time) {
    const byteArr = []

    while (time > 0) {
        byteArr.push(time % 256)
        time = Math.floor(time / 256)
    }

    return byteArr.reverse()  // big-endian
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
    let data = ""
    let tmplChar = ""

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

    if (ENTROPY[0] === 0) {
        ENTROPY[0] = 2 ** ENTROPYPERCHAR - 1
    } else {
        ENTROPY[0] = ENTROPY[0] << ENTROPYPERCHAR | 2 ** ENTROPYPERCHAR - 1
    }

    TEXTAREA.scrollTop = TEXTAREA.scrollHeight
    tmplChar = TEMPLATE.value[NTMPL]

    if (tmplChar === " ") {
        data = " "
        NTMPL++
    } else if (tmplChar === "D") {  // Diceware
        if (ENTROPY[0] >= 2 ** 13 - 1) {
            data = diceware8k[extract(8192)]
            ENTROPY[0] >>= 13
            NTMPL++
        }
    } else if (tmplChar === "M") {  // ASCII [[:graph:]]]
        if (ENTROPY[0] >= 2 ** 7 - 1) {
            data = String.fromCharCode(extract(94) + 33) // 33 = '!'
            ENTROPY[0] >>= 7
            NTMPL++
        }
    } else if (tmplChar === "S") {  // Pseudowords
        if (ENTROPY[0] >= 2 ** 16 - 1) {
            const vowels = "aiou"
            const consonants = "bdfghjklmnprstvz"
            data  = consonants[extract(16)]
            data += vowels[extract(4)]
            data += consonants[extract(16)]
            data += vowels[extract(4)]
            data += consonants[extract(16)]
            ENTROPY[0] >>= 16
            NTMPL++
        }
    } else if (tmplChar === "L") {  // Alphanumeric [[:digit:][:upper:][:lower:]]
        if (ENTROPY[0] >= 2 ** 6 - 1) {
            let rand = extract(62)
            if (rand < 10) {
                rand += 48                // 48 = '0'
            } else if (rand < 36) {
                rand += 55                // 55 + 10 = 'A'
            } else {
                rand += 61                // 61 + 36 = 'a'
            }
            data = String.fromCharCode(rand)
            ENTROPY[0] >>= 6
            NTMPL++
        }
    } else if (tmplChar === "A") {  // Alphabetic [[:upper:]]]
        if (ENTROPY[0] >= 2 ** 5 - 1) {
            data = String.fromCharCode(extract(26) + 65) // 65 = 'A'
            ENTROPY[0] >>= 5
            NTMPL++
        }
    } else if (tmplChar === "H") {  // Hexadecimal [[:xdigit:]]
        if (ENTROPY[0] >= 2 ** 4 - 1) {
            let rand = extract(16)
            if (rand < 10) {
                rand += 48                // 48 = '0'
            } else {
                rand += 55                // 55 + 10 = 'A'
            }
            data = String.fromCharCode(rand)
            ENTROPY[0] >>= 4
            NTMPL++
        }
    } else if (tmplChar === "9") {  // Decimal [[:digit:]]
        if (ENTROPY[0] >= 2 ** 4 - 1) {
            data = String.fromCharCode(extract(10) + 48) // 48 = '0'
            ENTROPY[0] >>= 4
            NTMPL++
        }
    } else if (tmplChar === "6") {  // Senary [1-6]
        if (ENTROPY[0] >= 2 ** 3 - 1) {
            data = String.fromCharCode(extract(6) + 49) // 49 = '1'
            ENTROPY[0] >>= 3
            NTMPL++
        }
    }

    TEXTAREA.value += data
    return
}

/**
 * Clear the text area and reinitialize but carry over the existing Spritz state.
 * @returns undefined
 */
function clearPasswords() {
    TEXTAREA.value = "Type here to generate your passwords.\n"

    if (CHARCOUNT < 40) {
        TEXTAREA.value += ".".repeat(CHARCOUNT)
    } else {
        TEXTAREA.value += ".".repeat(40) + "\n"
    }

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

    const scrippsText = "Typing these words guarantee 256 bits security:\n\n"
    document.getElementById("scripps").value = scrippsText + words.join(" ")
}

init()
