"use strict"

/**
 * Byte-oriented duplex using Keccak-f[1600] with a 1088-bit rate and
 * 512-bit capacity (the same parameters as SHAKE256).
 *
 * This is a custom duplex interface, not the FIPS 202 SHAKE256 XOF and not
 * an authenticated-encryption scheme. absorb() and squeeze() may be
 * interleaved. The frame bytes below are protocol constants for this class;
 * they are not standardized SHAKE domain-separation values.
 */
class Keccak {
  #state
  #output
  #outputPosition

  static #RATE = 136
  static #MASK = 0xffff_ffff_ffff_ffffn

  // Distinguish continuation, final, and output duplex calls.
  static #ABSORB_MORE = 0xa1
  static #ABSORB_FINAL = 0xa2
  static #SQUEEZE = 0xb1

  // Rotation offsets indexed by x + 5*y.
  static #ROTATION = [
     0,  1, 62, 28, 27,
    36, 44,  6, 55, 20,
     3, 10, 43, 25, 39,
    41, 45, 15, 21,  8,
    18,  2, 61, 56, 14
  ]

  static #ROUND_CONSTANTS = [
    0x0000000000000001n, 0x0000000000008082n,
    0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n,
    0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n,
    0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn,
    0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n,
    0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n,
    0x0000000080000001n, 0x8000000080008008n
  ]

  /** Initialize the 1600-bit state to zero. */
  constructor() {
    this.#state = new BigUint64Array(25)
    this.#output = new Uint8Array(Keccak.#RATE)
    this.#outputPosition = Keccak.#RATE
  }

  /** Apply the 24-round Keccak-f[1600] permutation. */
  #permute() {
    const a = this.#state
    const c = new Array(5)
    const d = new Array(5)
    const b = new Array(25)

    for (const roundConstant of Keccak.#ROUND_CONSTANTS) {
      // Theta
      for (let x = 0; x < 5; x++) {
        c[x] =
          a[x] ^
          a[x + 5] ^
          a[x + 10] ^
          a[x + 15] ^
          a[x + 20]
      }

      for (let x = 0; x < 5; x++) {
        const next = c[(x + 1) % 5]
        const rotated = ((next << 1n) | (next >> 63n)) &
          Keccak.#MASK
        d[x] = c[(x + 4) % 5] ^ rotated
      }

      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          a[x + 5 * y] ^= d[x]
        }
      }

      // Rho and Pi
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const index = x + 5 * y
          const rotation = Keccak.#ROTATION[index]
          const lane = a[index]
          const rotated = rotation === 0
            ? lane
            : (
                (lane << BigInt(rotation)) |
                (lane >> BigInt(64 - rotation))
              ) & Keccak.#MASK

          const newX = y
          const newY = (2 * x + 3 * y) % 5
          b[newX + 5 * newY] = rotated
        }
      }

      // Chi
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const index = x + 5 * y
          const next = ((x + 1) % 5) + 5 * y
          const afterNext = ((x + 2) % 5) + 5 * y

          a[index] =
            b[index] ^
            ((~b[next] & Keccak.#MASK) & b[afterNext])
        }
      }

      // Iota
      a[0] ^= roundConstant
    }
  }

  /**
   * XOR a framed, padded block into the rate portion of the state,
   * then apply Keccak-f[1600].
   *
   * The block layout is:
   *   frame || input || 0x01 || zeroes || 0x80
   *
   * @param {Array|Uint8Array} input Input bytes for this duplex call.
   * @param {number} frame Operation frame byte.
   */
  #duplexBlock(input, frame) {
    const block = new Uint8Array(Keccak.#RATE)

    block[0] = frame
    block.set(input, 1)
    block[1 + input.length] ^= 0x01
    block[Keccak.#RATE - 1] ^= 0x80

    for (let i = 0; i < Keccak.#RATE; i++) {
      const lane = Math.floor(i / 8)
      const shift = BigInt((i % 8) * 8)

      this.#state[lane] ^= BigInt(block[i]) << shift
    }

    this.#permute()
  }

  /** Copy the rate portion of the state into the current output block. */
  #readRateBlock() {
    for (let i = 0; i < Keccak.#RATE; i++) {
      const lane = Math.floor(i / 8)
      const shift = BigInt((i % 8) * 8)

      this.#output[i] = Number(
        (this.#state[lane] >> shift) & 0xffn
      )
    }
  }

  /**
   * Absorb bytes as one framed input operation.
   *
   * Inputs are divided into rate-sized duplex blocks with a frame byte and
   * pad10*1 padding. Multiple calls are distinct operations; in general,
   * absorb(x); absorb(y) is not equivalent to absorb(x || y).
   *
   * @param {Array|Uint8Array} data Bytes to absorb.
   */
  absorb(data) {
    if (!Array.isArray(data) && !(data instanceof Uint8Array)) {
      throw new TypeError("Input must be an Array or Uint8Array of bytes.")
    }

    for (const byte of data) {
      if (!Number.isInteger(byte) || byte < 0 || byte > 0xff) {
        throw new RangeError("Input values must be integers from 0 to 255.")
      }
    }

    // Do not allow unused bytes from a prior squeeze call to be returned
    // after the state has been updated with new input.
    this.#outputPosition = Keccak.#RATE

    const chunkSize = Keccak.#RATE - 2
    let offset = 0

    // Even an empty absorb is a framed duplex operation.
    if (data.length === 0) {
      this.#duplexBlock([], Keccak.#ABSORB_FINAL)

      return
    }

    while (offset < data.length) {
      const remaining = data.length - offset
      const length = Math.min(chunkSize, remaining)
      const final = length === remaining
      const chunk = data.slice(offset, offset + length)

      this.#duplexBlock(
        chunk,
        final
          ? Keccak.#ABSORB_FINAL
          : Keccak.#ABSORB_MORE
      )

      offset += length
    }
  }

  /**
   * Squeeze r bytes. Repeated calls continue at the previous output position;
   * absorbing new data discards any unused bytes from the current rate block.
   *
   * @param {number} r Number of output bytes.
   * @return {Array<number>} Unsigned output bytes.
   */
  squeeze(r) {
    if (!Number.isSafeInteger(r) || r < 0) {
      throw new RangeError("Output length must be a non-negative safe integer.")
    }

    const result = new Array(r)

    for (let i = 0; i < r; i++) {
      if (this.#outputPosition === Keccak.#RATE) {
        this.#duplexBlock([], Keccak.#SQUEEZE)
        this.#readRateBlock()
        this.#outputPosition = 0
      }

      result[i] = this.#output[this.#outputPosition++]
    }

    return result
  }
}
