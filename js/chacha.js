"use strict"

/** Class representing the ChaCha stream cipher. */
class ChaCha {
  #rounds     // Typically 8, 12, or 20.
  #keypos     // Pointer in the byte keystream.
  #keystream  // ChaCha keystream array.
  #state      // ChaCha state array.
  #pool       // Keyboard entropy pool.
  #pointer    // Pointer in the entropy pool.

  /** Initialize initial state of ChaCha with key, nonce, pointer, and rounds. */
  constructor() {
    const nonce = [
      Math.trunc(Date.now() / 0x1_0000_0000), // Upper 32-bits
      (Date.now() & 0xffffffff) >>> 0, // Lower 32-bits
      performance.now() >>> 0 // Rolls over after ~49.71 days of uptime.
    ]

    this.#rounds = 8
    this.#keypos = 0
    this.#keystream = Array.from(Array(64), (_, i) => 0)
    this.#pool = new Uint8Array(32)
    this.#pointer = 0
    this.#state = [
      0x61707865, 0x3320646e, 0x79622d32, 0x6b206574, // "expand 32-byte k"
      0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c, // RFC 8439 test vector key
      0x13121110, 0x17161514, 0x1b1a1918, 0x1f1e1d1c, // RFC 8439 test vector key
      0x00000001,   nonce[0],   nonce[1],   nonce[2]  // Counter and time-based nonce
    ]
  }

  /**
   * Return the ChaCha state.
   * @return {Array} - A 16 element array of 32 bytes.
   */
  get state() {
    return this.#state
  }

  /**
   * Set the ChaCha state.
   * @param {Array} s - An array of 16 32-byte integers.
   */
  set state(s) {
    if (
      s instanceof Array && // Ensure array argument.
      s.length === 16 && // Ensure 16 array elements.
      s.filter(Number.isInteger).length === 16 // Ensure 16 numbers.
    ) {
      // Clamp constants per spec to "expand 32-byte k", regardless.
      s[0] = 0x61707865
      s[1] = 0x3320646e
      s[2] = 0x79622d32
      s[3] = 0x6b206574

      // Force 32-bit unsigned values for the rest of the state.
      for (let i = 4; i < 16; i++) {
          s[i] &= 0xffffffff
          s[i] >>>= 0
      }

      this.#state = s
    } else {
      throw new Error(
        "Invalid state. Must be an array of 16 32-byte integers."
      )
    }
  }

  /**
   * Adds two numbers modulo 2^32.
   * @param {number} x - An unsigned 32-bit integer.
   * @param {number} y - An unsigned 32-bit integer.
   * @return {number} - An unsigned 32-bit integer.
   */
  #add(x, y) {
    return ((x + y) & 0xffffffff) >>> 0
  }

  /**
   * Rotate a 32-bit integer left with wrapping.
   * @param {number} d - The integer to rotate left.
   * @param {number} s - The left shift amount.
   * @return {number} - An unsigned 32-bit integer.
   */
  #rotl32(d, s) {
    return ((d << s) | (d >>> (32 - s))) >>> 0
  }

  /**
   * The defined quarter round operating on 4 elements of a state array.
   * @param {Array} s - A 16 element state array of 32 bytes.
   * @param {number} a - An array index.
   * @param {number} b - An array index.
   * @param {number} c - An array index.
   * @param {number} d - An array index.
   */
  #quarterRound(s, a, b, c, d) {
    s[a] = this.#add(s[a], s[b])
    s[d] ^= s[a]
    s[d] = this.#rotl32(s[d], 16)

    s[c] = this.#add(s[c], s[d])
    s[b] ^= s[c]
    s[b] = this.#rotl32(s[b], 12)

    s[a] = this.#add(s[a], s[b])
    s[d] ^= s[a]
    s[d] = this.#rotl32(s[d], 8)

    s[c] = this.#add(s[c], s[d])
    s[b] ^= s[c]
    s[b] = this.#rotl32(s[b], 7)
  }

  /**
   * The main ChaCha block function. Operates 8 quarter rounds on a 16 element
   * array. Treating the array as a 4x4 matrix, each "column" gets a quarter
   * round, followed by each "diagonal".
   * @return {Array} keystram - A 64-element array of 8-bit values.
   */
  #chachaBlock() {
    let b = 0
    const s = structuredClone(this.#state)

    for (let i = 0; i < this.#rounds; i += 2) {
      // Odd round
      this.#quarterRound(s, 0, 4, 8, 12) // Column 1
      this.#quarterRound(s, 1, 5, 9, 13) // Column 2
      this.#quarterRound(s, 2, 6, 10, 14) // Column 3
      this.#quarterRound(s, 3, 7, 11, 15) // Column 4
      // Even round
      this.#quarterRound(s, 0, 5, 10, 15) // Diagonal 1 (main diagonal)
      this.#quarterRound(s, 1, 6, 11, 12) // Diagonal 2
      this.#quarterRound(s, 2, 7, 8, 13) // Diagonal 3
      this.#quarterRound(s, 3, 4, 9, 14) // Diagonal 4
    }

    for (let i = 0; i < 16; i++) {
      s[i] = this.#add(this.#state[i], s[i])

      this.#keystream[b++] = s[i] & 0xff
      this.#keystream[b++] = (s[i] >>> 8) & 0xff
      this.#keystream[b++] = (s[i] >>> 16) & 0xff
      this.#keystream[b++] = (s[i] >>> 24) & 0xff
    }
  }

  /**
   * Encrypting and decrypting data is done by applying XOR to the data and
   * ChaCha keystream.
   * @param {Uint8Array} data - Array of data to XOR with the keystream.
   * @return {Uint8Array} output - Array of plaintext or ciphertext.
   * @throws {Error}
   */
  #update(data) {
    const output = new Uint8Array(data.length)

    for (let i = 0; i < data.length; i++) {
      if ((this.#keypos & 0x3f) === 0) {
        this.#keypos = 0
        this.#chachaBlock()
        this.#state[12]++
      }

      output[i] = data[i] ^ this.#keystream[this.#keypos]
      this.#keypos++
    }

    return output
  }

  /**
   * This rekeys the ChaCha cipher for use as an RNG. Keyboard entropy is
   * colleced into a 32-byte entropy pool. Once the pool is filled, a counter is
   * encrypted and combined with each byte in the entropy pool to rekey ChaCha.
   * There are 13 total bytes being collected by the keyboard:
   *  - 1 key value byte
   *  - 6 key press timestamp bytes
   *  - 6 key release timestamp bytes
   * Because 13 is relatively prime to 32, each of the 13 keyboard bytes will
   * see all 32 positions in the pool if the user types long enough. For mixing,
   * the pool bytes are XORed with the collected bytes.
   */
  #rekey() {
    const k = []

    for (let i = 0; i < 32; i += 4) {
      const k0 = this.#update(new Uint8Array([this.#pointer + i])) ^ this.#pool[i]
      const k1 = this.#update(new Uint8Array([this.#pointer + i + 1])) ^ this.#pool[i + 1]
      const k2 = this.#update(new Uint8Array([this.#pointer + i + 2])) ^ this.#pool[i + 2]
      const k3 = this.#update(new Uint8Array([this.#pointer + i + 3])) ^ this.#pool[i + 3]

      k.push(k0 | (k1 << 8) | (k2 << 16) | (k3 << 24))
    }

    for (let i = 0; i < 8; i++) {
      this.#state[i + 4] = k[i]
      this.#state[i + 4] >>>= 0
    }
  }

  /**
   * This function is is coupled with the squeeze() function to provide a
   * consistent API with Spritz while being used in PassGen3. The absorb() and
   * squeeze() functions here are a hack using the ChaCha stream cipher to
   * behave like a sponge. However, this does not turn ChaCha into a true sponge
   * construction.
   * @param {Uint8Array} data - An array of unsigned 8-bit integers.
   */
  absorb(data) {
    this.#update(data)

    for (let i = 0; i < data.length; i++) {
      this.#pool[this.#pointer++ & 0x1f] ^= data[i]
    }

    this.#rekey()
  }

  /**
   * This is encrypting a counter after the ChaCha state has been sufficiently
   * permuted and returning the ciphertext bytes. It is coupled with the
   * absorb() function to provide a consistent API with Spritz while being used
   * in PassGen3. The absorb() and squeeze() functions are a hack using the
   * ChaCha stream cipher to behave like a sponge. However, this does not turn
   * ChaCha into a true sponge construction.
   * @param {number} r - How many bytes to output.
   * @return {Array} - An r-length array of unsigned random 8-bit integers.
   */
  squeeze(r) {
    const p = new Uint8Array(r)

    for (let i = 0; i < r; i++) {
      p[i] = this.#update(new Uint8Array([this.#pointer + i]))
    }

    return Array.from(p)
  }
}
