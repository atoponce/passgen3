"use strict"

/** Class representing the Trivium stream cipher. */
class Trivium {
  #state      
  #keystream  // Trivium keystream.
  #pool
  #poolpos

  /**
   * Initialize Trivium with key and IV.
   * @param {Uint8Array} key - An 8-bit array of 10 unsigned integers.
   * @param {Uint8Array} iv - An 8-bit array of 10 unsigned integers.
   * @throws {Error}
   */
  constructor(key, iv) {
    if (typeof key === "undefined") {
      key = new Uint8Array([
        0x53, 0x65, 0x74, 0x20, 0x54, 0x72, 0x69, 0x76, 0x69, 0x75 // "Set Triviu"
      ])
    }

    if (typeof iv === "undefined") {
      iv = new Uint8Array([
        0x6d, 0x20, 0x6b, 0x65, 0x79, 0x20, 0x26, 0x20, 0x49, 0x56 // "m key & IV"
      ])
    }

    if (!(key instanceof Uint8Array) || key.length !== 10) {
      throw new Error("Key should be a 10-element Uint8Array.")
    }

    if (!(iv instanceof Uint8Array) || iv.length !== 10) {
      throw new Error("IV should be a 10-element Uint8Array.")
    }

    this.#pool = new Uint8Array(10)
    this.#poolpos = 0

    this.#state = Array.from(Array(288), (_, i) => 0)

    const keyBits = []
    const ivBits = []

    for (let i = 0; i < 10; i++) {
      keyBits.push(this.#byteToBits(key[i]))
      ivBits.push(this.#byteToBits(iv[i]))
    }

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
    if (!(data instanceof Uint8Array)) {
      throw new Error("Data should be a Uint8Array.")
    }

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
   * colleced into a 10-byte entropy pool. Once the pool is filled, an 80-bit
   * key is generated to rekey the Trivium state directly. There are 13 total
   * bytes being collected by the keyboard:
   *  - 1 key value byte
   *  - 6 key press timestamp bytes
   *  - 6 key release timestamp bytes
   * Because 13 is relatively prime to 10, each of the 13 keyboard bytes will
   * see all 64 positions in the pool if the user types long enough. Thus for
   * mixing, the pool bytes are XORed with the collected bytes.
   * @param {Uint8Array} data - An array of unsigned 8-bit integers.
   */
  #rekey(data) {
    for (let i = 0; i < data.length; i++) {
      this.#pool[this.#poolpos] ^= data[i]
      this.#poolpos++

      if (this.#poolpos === 10) {
        for (let j = 0; j < 80; j += 8) {
          this.#state[j + 0] = (this.#pool[j >> 3] >> 7) & 0x01
          this.#state[j + 1] = (this.#pool[j >> 3] >> 6) & 0x01
          this.#state[j + 2] = (this.#pool[j >> 3] >> 5) & 0x01
          this.#state[j + 3] = (this.#pool[j >> 3] >> 4) & 0x01
          this.#state[j + 4] = (this.#pool[j >> 3] >> 3) & 0x01
          this.#state[j + 5] = (this.#pool[j >> 3] >> 2) & 0x01
          this.#state[j + 6] = (this.#pool[j >> 3] >> 1) & 0x01
          this.#state[j + 7] = (this.#pool[j >> 3] >> 0) & 0x01
        }

        this.#poolpos = 0
      }
    }
  }

  /**
   * This is encryption while ignoring the returned ciphertext as we're not
   * interested in decrypting anything. It is coupled with the squeeze()
   * function to provide a consistent API with Spritz while being used in
   * PassGen3. The absorb() and squeeze() functions here are a hack using the
   * Trivium stream cipher to behave like a sponge. However, this does not turn
   * Trivium into a true sponge construction.
   * @param {Uint8Array} data - An array of unsigned 8-bit integers.
   */
  absorb(data) {
    this.#update(data)
    this.#rekey(data)
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
    const output = []

    for (let i = 0; i < r; i++) {
      p[i] = this.#update(new Uint8Array([i]))
    }

    return Array.from(p)
  }
}
