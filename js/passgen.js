"use strict"

// GLOBALS
const SPRITZ = new Spritz() // Initialize the Spritz state
const PRECHARS = 64 // number of characters required before any output (128 bits)
const ENTROPY = new Uint32Array(1) // The entropy bucket for tracking what entropy has been used and what is available
const TEXTAREA = document.getElementById("textarea")
const TEMPLATE = document.getElementById("template")
let SELTMPL = TEMPLATE.selectedIndex // track which template we're using

let NTMPL = 0 // keeps track of where we are in the textarea
let CHARCOUNT = 0 // allows multiple input characters per output character

/**
 * Initialize the Spritz state to a random state before keystrokes are entered.
 */
function init() {
  NTMPL = 0
  TEXTAREA.value = "Click here and start typing to generate your passwords:\n"

  TEXTAREA.addEventListener("keydown", keyDown)
  TEXTAREA.addEventListener("keyup", keyUp)

  // If a seed is saved from the last session size, absorb the seed and credit
  // the user with 64 characters already typed.
  if (window.localStorage.spritzSeed) {
    SPRITZ.absorb(JSON.parse(window.localStorage.spritzSeed))
    TEXTAREA.value += ".".repeat(PRECHARS) + "\n"
    CHARCOUNT = 64
  } else if (CHARCOUNT < PRECHARS) {
    TEXTAREA.value += ".".repeat(CHARCOUNT)
  } else {
    TEXTAREA.value += ".".repeat(PRECHARS) + "\n"
  }

  // Generate a unique browser fingerprint and convert to simple byte array.
  const fpBytes = []
  const fp = generateFingerprint()
  const l = fp.length

  for (let i = 0; i < l; i++) {
    fpBytes.push(fp.charCodeAt(i))
  }

  // Absorb the browser fingerprint
  SPRITZ.absorb(fpBytes)

  // Generate some random but difficult-to-type and generally long text for
  // the user. From the Scripps Spelling Bee word list.
  randomWords()
}

/**
 * Register a key press time in milliseconds and its value.
 * Spritz can be used as a deterministic random bit generator (DRBG). As Spritz
 * is a sponge construction, it is naturally a DRBG. The sponge state is the
 * "entropy pool". New random input can be included at any time using absorb(I)
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

  if (key.repeat) {
    key.preventDefault() // prevent key repeat
    return true
  }

  // use current time of key down (milliseconds) as a source of randomness
  const byteArr = int64ToByteArray(Date.now())
  SPRITZ.absorb(byteArr)

  // use character count as another source of randomness
  CHARCOUNT++
  SPRITZ.absorb(int64ToByteArray(CHARCOUNT))

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
 * "entropy pool". New random input can be included at any time using absorb(I)
 * and output may be extracted at any time using squeeze(r).
 * @param {Object} key - The keystroke
 * @returns true
 */
function keyUp(key) {
  // use current time of key up (milliseconds) as a source of randomness
  const byteArr = int64ToByteArray(Date.now())

  SPRITZ.absorb(byteArr)

  return true
}

/**
 * Convert a 64-bit integer to an 8-bit byte array.
 * @param {number} n - The 64-bit integer
 * @returns {Array} - An array of bytes representing the integer
 */
function int64ToByteArray(n) {
  const high = Math.trunc(n / 0x1_0000_0000)
  const low = n & 0xffff_ffff

  const byteArr = [
    (high >> 24) & 0xff,
    (high >> 16) & 0xff,
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 24) & 0xff,
    (low >> 16) & 0xff,
    (low >> 8) & 0xff,
    low & 0xff
  ]

  while (byteArr.indexOf(0) === 0) {
    byteArr.shift()
  }

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
  const diceware8k = dicewareWords()

  if (NTMPL >= TEMPLATE.value.length) {
    TEXTAREA.value += "\n"
    NTMPL = 0
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
  ENTROPY[0] = (ENTROPY[0] << 2) | (2 ** 2 - 1) // No parens, not a bug

  // Find our template to follow generating the password
  TEXTAREA.scrollTop = TEXTAREA.scrollHeight
  tmplChar = TEMPLATE.value[NTMPL]

  // Deduct entropy from the "entropy pool" as we build the password
  if (tmplChar === " ") {
    data = " "
    NTMPL++
  } else if (tmplChar === "D") {
    // Diceware
    if (ENTROPY[0] >= 8191) { // 2 ** 13 - 1
      data = diceware8k[extract(8192)]
      ENTROPY[0] >>= 13
      NTMPL++
    }
  } else if (tmplChar === "M") {
    // ASCII [[:graph:]]]
    if (ENTROPY[0] >= 127) { // 2 ** 7 - 1
      data = String.fromCharCode(extract(94) + 33) // 33 = '!'
      ENTROPY[0] >>= 7
      NTMPL++
    }
  } else if (tmplChar === "S") {
    // Pseudowords
    if (ENTROPY[0] >= 65535) { // 2 ** 16 - 1
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
    if (ENTROPY[0] >= 63) { // 2 ** 6 - 1
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
    if (ENTROPY[0] >= 31) { // 2 ** 5 - 1
      data = String.fromCharCode(extract(26) + 65) // 65 = 'A'
      ENTROPY[0] >>= 5
      NTMPL++
    }
  } else if (tmplChar === "H") {
    // Hexadecimal [[:xdigit:]]
    if (ENTROPY[0] >= 15) { // 2 ** 4 - 1
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
    if (ENTROPY[0] >= 15) { // 2 ** 4 - 1
      data = String.fromCharCode(extract(10) + 48) // 48 = '0'
      ENTROPY[0] >>= 4
      NTMPL++
    }
  } else if (tmplChar === "6") {
    // Senary [1-6]
    if (ENTROPY[0] >= 7) { // 2 ** 3 - 1
      data = String.fromCharCode(extract(6) + 49) // 49 = '1'
      ENTROPY[0] >>= 3
      NTMPL++
    }
  }

  TEXTAREA.value += data
  return
}

/** Save the current Spritz state to disk.  */
function saveEntropy() {
  localStorage.setItem("spritzSeed", JSON.stringify(SPRITZ.squeeze(32)))
}

/**
 * Generate a uniformly distributed list of 5-digit numbers so as not to collide
 * with the numbers found in diceware8k.js. The goal of this function is to
 * fill the list of candidate words for the user to type, such that the length
 * of the candidate words is a multiple of a power of 2.
 * @param {number} n - The number of 5-digit numbers needed.
 * @returns {Array} - An array of uniformly distributed 5-digit numbers.
 */
function uniformDigits(n) {
  const picked = []
  const fiveDigits = Array.from({length: 100000}, (_, n) =>
  n.toString().padStart(5, "0"))

  // Starts at 1 to prevent generating one 5-digit number too many.
  for (let i = 1; i < 100000; i += (100000/n)) {
    picked.push(fiveDigits[Math.floor(i)])
  }

  return picked
}

/**
 * Generate some random text for the user to type. The words are either obscure,
 * long, or both. The are also difficult to pronounce, which should make them
 * difficult to type. This improves entropy via irregular key stroke timings
 * and typing mistakes.
 */
function randomWords() {
  let rand
  const security = 512
  const size = 65536
  const toType = []
  const words = [...new Set(Array.prototype.concat(
    obscureWords(), dicewareWords(), blendWords(), loremIpsum(), unitWords()
  ))]
  const digits = uniformDigits(size - words.length)
  const finalList = [...new Set(Array.prototype.concat(words, digits))]

  // Guaranteed "size"-bits security, regardless of keystroke entropy
  const req = Math.ceil(security / Math.log2(size))

  for (let i = 0; i < req; i++) {
    rand = extract(size)
    toType.push(finalList[rand])
  }

  const randomText =
    "Try typing the following accurately to maximize entropy:\n\n"
  document.getElementById("random").value = randomText + toType.join(" ")
}

/**
 * Unit test to ensure that the Spritz cipher is behaving per the original paper.
 * @return {bool} - true if the test vectors pass, false otherwise
 */
function testVectors() {
  /*
   * The test vectors per the original paper are:
   *    Basic Spritz output:
   *        "ABC": 0x77 0x9a 0x8e 0x01 0xf9 0xe9 0xcb 0xc0 ...
   *       "spam": 0xf0 0x60 0x9a 0x1d 0xf1 0x43 0xce 0xbf ...
   *    "arcfour": 0x1a 0xfa 0x8b 0x5e 0xe3 0x37 0xdb 0xc7 ...
   *    32 byte hash:
   *        "ABC": 0x02 0x8f 0xa2 0xb4 0x8b 0x93 0x4a 0x18 ...
   *       "spam": 0xac 0xbb 0xa0 0x81 0x3f 0x30 0x0d 0x3a ...
   *    "arcfour": 0xff 0x8c 0xf2 0x68 0x09 0x4c 0x87 0xb9 ...
   *
   * However, with the bias countermeasure in place, the test vectors change.
   * After verifying the original test vectors before the countermeasure,
   * these are the new test vectors:
   *    Basic Spritz output:
   *        "ABC": 0x19 0x6e 0xdf 0xc8 0x63 0x5b 0xca 0x07 ...
   *       "spam": 0x2f 0xd9 0x62 0x8b 0x02 0x6e 0xa2 0xc8 ...
   *    "arcfour": 0x90 0xe8 0xd8 0xdb 0x44 0xb2 0x42 0x6f ...
   *    32 byte hash:
   *        "ABC": 0x3f 0xcd 0x67 0x2a 0xab 0xce 0x5e 0x8d ...
   *       "spam": 0x00 0xc5 0x69 0xfd 0x18 0xd1 0x32 0x4c ...
   *    "arcfour": 0x87 0xc3 0xb1 0x4e 0x42 0x92 0x73 0xee ...
   */

  let codes = []
  let s = new Spritz()
  for (const c of "ABC") {
    codes.push(c.charCodeAt(0))
  }
  s.absorb(codes)
  if (JSON.stringify(s.squeeze(8)) !== "[25,110,223,200,99,91,202,7]") {
    console.error("Failed test vector for basic Spritz of 'ABC'")
    return false
  }

  codes = []
  s = new Spritz()
  for (const c of "spam") {
    codes.push(c.charCodeAt(0))
  }
  s.absorb(codes)
  if (JSON.stringify(s.squeeze(8)) !== "[247,217,98,139,2,110,162,200]") {
    console.error("Failed test vector for basic Spritz of 'spam'")
    return false
  }

  codes = []
  s = new Spritz()
  for (const c of "arcfour") {
    codes.push(c.charCodeAt(0))
  }
  s.absorb(codes)
  if (JSON.stringify(s.squeeze(8)) !== "[144,232,216,219,68,178,66,111]") {
    console.error("Failed test vector for basic Spritz of 'arcfour'")
    return false
  }


  codes = []
  s = new Spritz()
  for (const c of "ABC") {
    codes.push(c.charCodeAt(0))
  }
  s.absorb(codes)
  s.absorbStop()
  s.absorb([32])
  if (JSON.stringify(s.squeeze(8)) !== "[63,205,103,42,171,206,94,141]") {
    console.error("Failed test vector for Spritz hash of 'ABC'")
    return false
  }

  codes = []
  s = new Spritz()
  for (const c of "spam") {
    codes.push(c.charCodeAt(0))
  }
  s.absorb(codes)
  s.absorbStop()
  s.absorb([32])
  if (JSON.stringify(s.squeeze(8)) !== "[0,197,105,253,24,209,50,76]") {
    console.error("Failed test vector for Spritz hash of 'spam'")
    return false
  }

  codes = []
  s = new Spritz()
  for (const c of "arcfour") {
    codes.push(c.charCodeAt(0))
  }
  s.absorb(codes)
  s.absorbStop()
  s.absorb([32])
  if (JSON.stringify(s.squeeze(8)) !== "[135,195,177,78,66,146,115,238]") {
    console.error("Failed test vector for Spritz hash of 'arcfour'")
    return false
  }

  return true
}

if (testVectors()) {
  init()
} else {
  TEXTAREA.innerText = "Test vectors failed. Please check the JavaScript console errors."
}
