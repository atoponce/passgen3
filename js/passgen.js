// GLOBALS
const SPRITZ = new Spritz() // Initialize the Spritz state
const PRECHARS = 64 // number of characters required before any output (80 bits)
const ENTROPYPERCHAR = 2 // amount of entropy per character
const ENTROPY = new Uint32Array(1) // The entropy bucket for tracking what entropy has been used and what is available
const TEMPLATE = document.getElementById("template")
const TEXTAREA = document.getElementById("textarea")

let NTMPL = 0 // keeps track of where we are in the textarea
let CHARCOUNT = 0 // allows multiple input characters per output character
let SELTMPL = TEMPLATE.selectedIndex // track which template we're using

TEXTAREA.value = "Type here to generate your passwords.\n"

/**
 * Initialize the Spritz state to a random state before keystrokes are entered.
 */
function init() {
  TEXTAREA.addEventListener("keydown", keyDown)
  TEXTAREA.addEventListener("keyup", keyUp)

  // If the Spritz state is saved from the last session and N didn't change
  // size, load the state. Otherwise, initilaze Spritz with the new size of N.
  if (window.localStorage.spritzState) {
    SPRITZ.state = JSON.parse(window.localStorage.spritzState)
  }

  // Generate a unique browser fingerprint and convert to simple byte array.
  const fpBytes = []
  const fp = generateFingerprint()
  const l = fp.length

  for (let i = 0; i < l; i++) {
    fpBytes.push(fp.charCodeAt(i))
  }

  // Spritz is a capable hash function: hash(M, r) produces an r-byte hash of
  // the input message (byte sequence) M defined as:
  //      1. InitializeState()
  //      2. absorb(M); absorbStop()
  //      3. abosorb(r)
  //      4. return squeeze(r)
  // We're only interested in permuting the Spritz state, not returning an
  // actual hash value. Thus we can skip steps 3 and 4.
  SPRITZ.absorb(fpBytes)
  SPRITZ.absorbStop()

  // Generate some random but difficult-to-type and generally long text for
  // the user. From the Scripps Spelling Bee word list.
  randomScripps()
}

/**
 * Register a key press time in milliseconds and its value.
 * Spritz can be used as a deterministic random bit generator (DRBG). As Spritz
 * is a sponge construction, it is naturally a DRBG. The sponge state is the
 * "entropy pool". New random input can be included at any time using aborb(I)
 * and output may be extracted at any time using squeeze(r).
 * @param {Object} key - The keystroke
 * @returns true
 */
function keyDown(key) {
  const movementKeys = [
    " ",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "PageDown",
    "PageUp",
    "Home",
    "End",
    "Tab",
  ]

  if (movementKeys.includes(key.key)) {
    key.preventDefault() // prevent keys from scrolling the page
  }

  SPRITZ.absorb([key.key.charCodeAt(0)])
  SPRITZ.absorbStop()

  if (key.repeat) {
    key.preventDefault() // prevent key repeat
    return true
  }

  // use current time of key down (milliseconds) as source randomness
  const byteArr = timeToByteArray(Date.now())

  SPRITZ.absorb(byteArr)
  SPRITZ.absorbStop()

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
 * Register a key release time in milliseconds and its value.
 * Spritz can be used as a deterministic random bit generator (DRBG). As Spritz
 * is a sponge construction, it is naturally a DRBG. The sponge state is the
 * "entropy pool". New random input can be included at any time using aborb(I)
 * and output may be extracted at any time using squeeze(r).
 * @param {Object} key - The keystroke
 * @returns true
 */
function keyUp(key) {
  // use current time of key up (milliseconds) as source randomness
  const byteArr = timeToByteArray(Date.now())

  SPRITZ.absorb(byteArr)
  SPRITZ.absorbStop()

  return true
}

/**
 * Convert a time in milliseconds to an 8-bit byte array.
 * @param {number} time - The time in milliseconds
 * @returns {Array} - An array of bytes representing the time
 */
function timeToByteArray(time) {
  const high = Math.trunc(time / 0x100000000)
  const low = time & 0xffffffff

  // time = Date.now() is <= 48-bits.
  const byteArr = [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 24) & 0xff,
    (low >> 16) & 0xff,
    (low >> 8) & 0xff,
    low & 0xff
  ]

  return byteArr
}

/**
 * Uniformly extract a random number from Spritz.
 * @param {number} r - A maximum value
 * @returns {number} - A number between [0, r-1]
 */
function extract(r) {
  let a, q
  const min = 65536 % r

  do {
    a = SPRITZ.squeeze(2)
    q = a[0] << 8 | a[1]
  } while (q < min) // avoid biased choice

  return q % r
}

/**
 * Generate a character or word based on the random number from Spritz.
 * Each template is defined in the index.html for this function to follow when
 * generating passwords. Given that we know the size of each word list and
 * character set, we know how much entropy exists with each choice in the set.
 * Key stroke entropy is collected in an "entropy pool". Depending on the
 * template, we deduct the required entropy to generate each character/word in
 * the password. As such, entropy is constantly increases and decreasing while
 * keys are being typed and passwords are being generated.
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

  // Build up the "entropy pool"
  ENTROPY[0] = (ENTROPY[0] << ENTROPYPERCHAR) | (2 ** ENTROPYPERCHAR - 1) // No parens, not a bug

  // Find our template to follow generating the password
  TEXTAREA.scrollTop = TEXTAREA.scrollHeight
  tmplChar = TEMPLATE.value[NTMPL]

  // Deduct entropy from the "entropy pool" as we build the password
  if (tmplChar === " ") {
    data = " "
    NTMPL++
  } else if (tmplChar === "D") {
    // Diceware
    if (ENTROPY[0] >= 2 ** 13 - 1) {
      data = diceware8k[extract(8192)]
      ENTROPY[0] >>= 13
      NTMPL++
    }
  } else if (tmplChar === "M") {
    // ASCII [[:graph:]]]
    if (ENTROPY[0] >= 2 ** 7 - 1) {
      data = String.fromCharCode(extract(94) + 33) // 33 = '!'
      ENTROPY[0] >>= 7
      NTMPL++
    }
  } else if (tmplChar === "S") {
    // Pseudowords
    if (ENTROPY[0] >= 2 ** 16 - 1) {
      const vowels = "aiou"
      const consonants = "bdfghjklmnprstvz"
      data = consonants[extract(16)]
      data += vowels[extract(4)]
      data += consonants[extract(16)]
      data += vowels[extract(4)]
      data += consonants[extract(16)]
      ENTROPY[0] >>= 16
      NTMPL++
    }
  } else if (tmplChar === "L") {
    // Alphanumeric [[:digit:][:upper:][:lower:]]
    if (ENTROPY[0] >= 2 ** 6 - 1) {
      let rand = extract(62)
      if (rand < 10) {
        rand += 48 // 48 = '0'
      } else if (rand < 36) {
        rand += 55 // 55 + 10 = 'A'
      } else {
        rand += 61 // 61 + 36 = 'a'
      }
      data = String.fromCharCode(rand)
      ENTROPY[0] >>= 6
      NTMPL++
    }
  } else if (tmplChar === "A") {
    // Alphabetic [[:upper:]]]
    if (ENTROPY[0] >= 2 ** 5 - 1) {
      data = String.fromCharCode(extract(26) + 65) // 65 = 'A'
      ENTROPY[0] >>= 5
      NTMPL++
    }
  } else if (tmplChar === "H") {
    // Hexadecimal [[:xdigit:]]
    if (ENTROPY[0] >= 2 ** 4 - 1) {
      let rand = extract(16)
      if (rand < 10) {
        rand += 48 // 48 = '0'
      } else {
        rand += 55 // 55 + 10 = 'A'
      }
      data = String.fromCharCode(rand)
      ENTROPY[0] >>= 4
      NTMPL++
    }
  } else if (tmplChar === "9") {
    // Decimal [[:digit:]]
    if (ENTROPY[0] >= 2 ** 4 - 1) {
      data = String.fromCharCode(extract(10) + 48) // 48 = '0'
      ENTROPY[0] >>= 4
      NTMPL++
    }
  } else if (tmplChar === "6") {
    // Senary [1-6]
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
 * Clear the text area and reinitialize but carry over the Spritz state.
 * @returns undefined
 */
function clearPasswords() {
  TEXTAREA.value = "Type here to generate your passwords.\n"

  if (CHARCOUNT < PRECHARS) {
    TEXTAREA.value += ".".repeat(CHARCOUNT)
  } else {
    TEXTAREA.value += ".".repeat(PRECHARS) + "\n"
  }

  NTMPL = 0

  init()

  return
}

/** Save the current Spritz state to disk.  */
function saveEntropy() {
  localStorage.setItem("spritzState", JSON.stringify(SPRITZ.state))
}

/**
 * Generate some random text for the user to type from the Scripps Spelling Bee
 * word list. The words are generally long and dificult to prounounce, which
 * should make them difficult to type as well. This improves entropy via
 * irregular key stroke timings and typing mistakes.
 */
function randomScripps() {
  let rand
  const words = []
  const len = scripps.length
  const req = Math.ceil(256 / Math.floor(Math.log2(len)))

  for (let i = 0; i < req; i++) {
    rand = extract(len)
    words.push(scripps[rand])
  }

  const scrippsText =
    "Need something to type? These words provide 256-bits of entropy:\n\n"
  document.getElementById("scripps").value = scrippsText + words.join(" ")
}

init()
