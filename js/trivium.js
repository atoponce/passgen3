"use strict"

/** Class representing the Trivium stream cipher. */
class Trivium {
  #state      // Trivium state bit array.
  #keystream  // Trivium keystream.
  #pool       // Keyboard entropy pool.
  #counter    // Keyboard entropy pool counter.

  /** Initialize Trivium with key and IV. */
  constructor() {
    const now = Date.now()
    const perf = performance.now() >>> 0

    const high = Math.trunc(now / 0x1_0000_0000) // Upper 32-bits
    const low = (now & 0xffffffff) >>> 0  // Lower 32-bits

    // Date.now() in milliseconds since Jan 1, 1970 00:00:00 is 48-bits long.
    const t = [
       (high >>  8) & 0xff, high & 0xff,
       (low >> 24) & 0xff, (low >> 24) & 0xff, (low >>  8) & 0xff, low & 0xff,
    ]

    // That leaves 32-bits for performance.now(), or about 49.71 days of uptime.
    const p = [
      (perf >> 24) & 0xff, (perf >> 16) & 0xff, (perf >> 8) & 0xff, perf & 0xff
    ]

    const key = new Uint8Array([
      0x54, 0x72, 0x69, 0x76, 0x69, 0x75, 0x6d, 0x4B, 0x65, 0x79 // "TriviumKey"
    ])

    const iv = new Uint8Array([
      t[0], t[1], t[2], t[3], t[4], t[5], p[0], p[1], p[2], p[3] // Time-based IV
    ])

    this.#state = new Array(288).fill(0)
    this.#pool = new Uint8Array(10)
    this.#counter = 0

    const keyBits = []
    const ivBits = []

    for (let i = 0; i < 10; i++) {
      let tmpBits = this.#byteToBits(key[i]).reverse()

      for (let j = 0; j < 8; j++) {
        keyBits.push(tmpBits[j])
      }

      tmpBits = this.#byteToBits(iv[i]).reverse()

      for (let j = 0; j < 8; j++) {
        ivBits.push(tmpBits[j])
      }
    }

    keyBits.reverse()
    ivBits.reverse()

    for (let i = 0; i < 80; i++) {
      this.#state[i] = keyBits[i]
      this.#state[i + 93] = ivBits[i]
    }

    this.#state[285] = 1
    this.#state[286] = 1
    this.#state[287] = 1

    for (let i = 0; i < (288 << 2); i++) {
      this.#genKeyStream()
    }
  }

  /**
   * Return the Trivium state.
   * @return {Array} - A 16 element array of 32 bytes.
   */
  get state() {
    return this.#state
  }

  /**
   * Set the Trivium state.
   * @param {Array} s - An array of 16 32-byte integers.
   */
  set state(s) {
    if (
      s instanceof Array && // Ensure array argument.
      s.length === 288 && // Ensure 288 array elements.
      s.filter(Number.isInteger).length === 288 // Ensure 288 numbers.
    ) {
      // Force 1-bit values for the full state.
      for (let i = 0; i < 288; i++) {
        s[i] &= 1
      }

      // Clamp the last 3 bits to '1' to mitigate an all-zero state.
      s[285] = 1
      s[286] = 1
      s[287] = 1

      this.#state = s
    } else {
      throw new Error(
        "Invalid state. Must be an array of 16 32-byte integers."
      )
    }
  }

  /**
   * Generates a keystream bit and manipulates the Trivium state. The Trivium
   * state is defined with three non-linear feedback shift registers: s1 (93
   * bits), s2 (84 bits), and s3 (111 bits). Each state is modified
   * independently and each state depends on a single bit from the other,
   * creating a circular dependency on itself.
   * @returns {number} z - A single keystream bit.
   */
  #genKeyStream() {
    let t1 = this.#state[65] ^ this.#state[92]
    let t2 = this.#state[161] ^ this.#state[176]
    let t3 = this.#state[242] ^ this.#state[287]

    let z = t1 ^ t2 ^ t3

    t1 ^= (this.#state[90] & this.#state[91]) ^ this.#state[170]
    t2 ^= (this.#state[174] & this.#state[175]) ^ this.#state[263]
    t3 ^= (this.#state[285] & this.#state[286]) ^ this.#state[68]

    this.#state.pop()

    this.#state.unshift(t3)
    this.#state[93] = t1
    this.#state[177] = t2

    return z
  }

  /**
   * Convert an unsigned 8-bit integer to a bit-array.
   * @param{number} byte - An 8-bit unsigned integer.
   * @returns {Uint8Array} bits - An 8-element bit array.
   */
  #byteToBits(byte) {
    const bits = new Uint8Array(8)

    for (let i = 0; i < 8; i++) {
      bits[i] = (byte >> (7 - i)) & 1
    }

    return bits
  }

  /**
   * Convert a bit-array to a an unsigned 8-bit integer.
   * @param{Uint8Array} bits - An 8-element bit array.
   * @returns {number} byte - An 8-bit unsigned integer.
   */
  #bitsToByte(bits) {
    let byte = 0

    for (let i = 0; i < 8; i++) {
      byte |= (bits[i] << (7 - i))
    }

    return byte
  }

  /**
   * Encrypting and decrypting data is done by applying XOR to the data and
   * Trivium keystream.
   * @param {Uint8Array} data - Array of data to XOR with the keystream.
   * @return {Uint8Array} output - Array of plaintext or ciphertext bytes.
   * @throws {Error}
   */
  #update(data) {
    const output = new Uint8Array(data.length)

    for (let i = 0; i < data.length; i++) {
      const inputBits = this.#byteToBits(data[i])
      const outputBits = new Uint8Array(8)

      for (let j = 7; j >= 0; j--) {
        outputBits[j] = inputBits[j] ^ this.#genKeyStream()
      }

      output[i] = this.#bitsToByte(outputBits)
    }

    return output
  }

  /**
   * This rekeys the Trivium cipher for use as an RNG. Keyboard entropy is
   * colleced into a 10-byte entropy pool. Once the pool is filled, a counter is
   * encrypted and combined with each byte in the entropy pool to rekey Trivium.
   * There are 13 total bytes being collected by the keyboard:
   *  - 1 key value byte
   *  - 6 key press timestamp bytes
   *  - 6 key release timestamp bytes
   * Because 13 is relatively prime to 10, each of the 13 keyboard bytes will
   * see all 10 positions in the pool if the user types long enough. For mixing,
   * the pool bytes are XORed with the collected bytes.
   */
  #rekey() {
    const k = []

    for (let i = 0; i < 10; i++) {
      const byte = this.#update(new Uint8Array([this.#counter + i])) ^ this.#pool[i]
      const bits = this.#byteToBits(byte)

      for (let j = 0; j < 8; j++) {
        k.push(bits[j])
      }
    }

    for (let i = 0; i < 80; i++) {
      this.#state[i] = k[i]
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
      this.#pool[this.#counter++ % 10] ^= data[i]
    }

    this.#rekey()
  }

  /**
   * This is encrypting a counter after the Trivium state has been sufficiently
   * permuted and returning the ciphertext bytes. It is coupled with the
   * absorb() function to provide a consistent API with Spritz while being used
   * in PassGen3. The absorb() and squeeze() functions are a hack using the
   * Trivium stream cipher to behave like a sponge. However, this does not turn
   * Trivium into a true sponge construction.
   * @param {number} r - How many bytes to output.
   * @return {Array} - An r-length array of unsigned random 8-bit integers.
   */
  squeeze(r) {
    const p = new Uint8Array(r)

    for (let i = 0; i < r; i++) {
      p[i] = this.#update(new Uint8Array([this.#counter + i]))
    }

    return Array.from(p)
  }
}
