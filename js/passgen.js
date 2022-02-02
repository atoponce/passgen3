// GLOBALS
const NMIXES = 100 * 256    // number of spritz characters discarded per output character
const PRECHARS = 22         // number of characters required before any output
const CHARSPEROUTPUT = 3    // number of characters input per output character

let consonantNext = true

// Spritz parameters
const S = []                // Spritz state vector
let ii = jj = kk = zz = 0
let ww = 1                  // must be coprime to 256

const template = document.getElementById("template")
const textarea = document.getElementById("textarea")

let ntmpl = 0               // keeps track of where we are in the textarea
let charCount = 0           // allows multiple input characters per output character
let randArr = [0, 0]        // array to hold random numbers for diceware

function init() {
    stir(Date.now())        // use current time (milliseconds) as source randomness

    for (let i = 0; i < 256; i++) {
        S[i] = i
    }

    document.addEventListener("keydown", keyDown)
    document.addEventListener("keyup", keyUp)

    stir(Date.now())        // use current time as source randomness again
}

function keyDown(key) {
    stir(Math.floor(window.performance.now() * 10.6))
    stir(key.key.charCodeAt(0))

    const start = window.performance.now()
    while (window.performance.now - start < 100) {
        stir(0)             // stir more in case of browser fingerprint resistance
    }

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

function keyUp(key) {
    stir(Math.floor(window.performance.now() * 10e6))

    const start = window.performance.now()
    while (window.performance.now - start < 100) {
        stir(0)             // stir more in case of browser fingerprint resistance
    }

    return true
}

function stir(x) {
    // Maintain a pool of randomness using the Spritz algorithm
    while (true) {
        ii = (ii + ww) % 256
        jj = (kk + S[(jj + S[ii]) % 256]) % 256
        kk = (kk + ii + S[jj]) % 256

        let swap = S[ii]
        S[ii] = S[jj]
        S[jj] = swap

        zz = S[(jj + S[(ii + S[(zz + kk) % 256]) % 256]) % 256]

        x = Math.floor(x / 256)

        if (x === 0) {
            break
        }
    }

    return zz
}

function extract(r) {
    let q = 0
    ii = jj = kk = zz = 0
    ww += 2                   // all odd numbers are coprime to 256

    for (let k = 0; k < NMIXES; k++) { // we can afford a lot of mixing
        stir(0)
    }
    
    while (true) {
        q = stir(0)

        if (q < r * (256 / r)) { // avoid biased choice
            break
        }
    }

    return (q % r)
}

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
    } else if (tmplChar === "D" || tmplChar === "W") {  // Random Diceware word
        addDiceware(tmplChar)
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

function addDiceware(ch) {
    let word
    let choice

    if (ch === "D") {
        randArr[0] = extract(256)
    } else {
        randArr[1] = extract(256)
        choice = randArr[0] << 8 | randArr[1]
        word = diceware8k[choice % 8192]
        textarea.value += word
    }
    
    return
}

init()
