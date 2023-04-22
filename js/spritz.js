// Configurable. Can be any integer > 2. Smaller N is easier to detect biases.
// The Spritz designers tested N = 16, 24, 32, 64, 128, & 256 (recommended).
const N = 256

// Do not change anything below this line.
/** Initialize Spritz to its standard initial state */
const Spritz = {
    i: 0, // Increases by w % N when drip() is called.
    j: 0, // Changes pseudorandomly.
    k: 0, // Changes pseudorandomly.
    a: 0, // Counts how many nibble have been absorbed.
    w: 1, // Always relatively prime to N, updated when whip(r) is called.
    z: 0, // Records the last output byte produces.
    S: Array.from(Array(N), (_, v) => v) // Spritz state array.
}

/**
 * Swaps two elements in an array.
 * @param {Array} arr - An array of integer elements.
 * @param {number} x - An array index.
 * @param {number} y - An array index.
 * @returns {Array} - The updated array with swapped elements.
 */
function _swap(arr, x, y) {
    return [arr[x], arr[y]] = [arr[y], arr[x]]
}

/**
 * Adds two numbers modulo N.
 * @param {number} x - An integer.
 * @param {number} y - An integer.
 * @returns {number} - The sum of x and y modulo N.
 */
function _add(x, y) {
    return (x + y) % N
}

/**
 * Recursively finds the greatest common divisor of two numbers.
 * @param {number} x - An integer.
 * @param {number} y - An integer.
 * @returns {number} - The greatest common divisor.
 */
function _gcd(x, y) {
    if (!y) {
        return x
    }

    return _gcd(y, x % y)
}

/**
 * Take a variable-length input sequence and updates the Spritz state. Can be
 * called for additional input even after it has produced some output, since
 * absorb() merely updates the current state without re-initializing it. This
 * corresponsd to "duplex mode" in sponge function terminology. An input "I" may
 * be supplied in pieces, each of non-negative length, using absorb(x) on each
 * piece. It doesn't matter how the input is divided into pieces since
 * "absorb(x); absorb(y);" is equivalent to "absorb(xy)".
 * @param {Array} I - An array of unsigned 8-bit integers.
 */
function absorb(I) {
    const l = I.length

    for (let v = 0; v < l; v++) {
        absorbByte(I[v])
    }
}

/**
 * Updates the current Spritz state based on a given byte by splitting the
 * byte into two nibbles and updating the state based on each nibble,
 * low-order first.
 * @param {number} b - An unsigned 8-bit integer.
 */
function absorbByte(b) {
    absorbNibble(b & 0xf) // low
    absorbNibble(b >> 4)  // high
}

/**
 * First test whether Spritz is "full" of absorbed data. If so, calls shuffle()
 * to mix the absorbed data and reset a to 0. Then updates the state based on
 * the value of the supplied nibble.
 * @param {number} x - An unsigned 4-bit integer.
 */
function absorbNibble(x) {
    const h = N >> 1

    if (Spritz.a >= h) {
        shuffle()
    }

    _swap(Spritz.S, Spritz.a, _add(h, x))

    Spritz.a += 1
}

/**
 * Same as absorbNibble(x), except no swapping is done. May be used to ensure
 * that the input from the preceding absorb(I) and that of a following absorb(I)
 * are cleanly separated. More precisely, "absorb(x); absorb(y);" is fully
 * equivalent to "absorb(xy)"". Putting absorbStop() between the two calls to
 * absorb(I) ensures this is not true.
 */
function absorbStop() {
    if (Spritz.a >= N >> 1) {
        shuffle()
    }

    Spritz.a += 1
}

/**
 * Whips, crushes, whips, chushes, and then whips again. Each whip(r) randomizes
 * the state. Because crush() is called between each pair of calls to whip(r),
 * the effects of crush() are not easily determined by manipulating the input,
 * and any biases introduced by crush() are smoothed out before shuffle()
 * returns. The parameter "2 * N" on the size of each whip(r) is chosen to
 * produce a strong isolation of shuffle() inputs/outputs and crush()
 * inputs/outputs from each other.
 */
function shuffle() {
    const d = N << 1

    whip(d)
    crush()
    whip(d)
    crush()
    whip(d)

    Spritz.a = 0
}

/**
 * Calls update() a specified number of r-times. The Spritz system is "being
 * whipped" without producing output. The registers and permutation state are
 * given new values that is a complex function of their initial values, with
 * larger values of "r" resulting in more complexity. The use of whip(r) reflect
 * a common recommendation for improving RC4. Every whip(r) call also updates
 * "w" to the next larger value that is relatively prime to "N", so that the
 * repeated execution of "i += w" in the first line of update() causes "i" to
 * cycle between all values modulo N.
 * @param {number} r - How many times to call update() without producing output.
 */
function whip(r) {
    for (let v = 0; v < r; v++) {
        update()
    }

    do {
        Spritz.w += 1
    } while (_gcd(Spritz.w, N) !== 1)
}

/**
 * Provides a noninvertible transformation from states to states. Intentionally
 * "loses information" about the current state. More precisely, it maps 2^(N/2)
 * states to one, since each N/2 pairs of compared values in the state are
 * sorted into increasing order.
 */
function crush() {
    const h = N >> 1

    for (let v = 0; v < h; v++) {
        if (Spritz.S[v] > Spritz.S[255 - v]) {
            _swap(Spritz.S, v, 255 - v)
        }
    }
}

/**
 * The main output function for Spritz. The name derives from the terminology of
 * sponge functions (think squeezing water from a sponge). Equivalent to calling
 * drip() r-times.
 * @param {number} r - How many output bytes (N-values) to produce.
 * @returns {Array} - An r-length array of unsigned random integers.
 */
function squeeze(r) {
    if (Spritz.a > 0) {
        shuffle()
    }

    const p = []

    for (let v = 0; v < r; v++) {
        p.push(drip())
    }

    return p
}

/**
 * The basic pseudorandom output routine designed to ensure that Spritz is in
 * "squeezing mode", updates the Spritz state using update(), and produces one
 * output byte using output(). The test for a > 0 and call to shuffle() are
 * placed both here and in squeeze(r) so that drip() may be safely called
 * directly by applications, ensuring that absorbed data is always shuffled
 * before any output is produced.
 * @returns {number} - An unsigned random integer.
 */
function drip() {
    if (Spritz.a > 0) {
        shuffle()
    }

    update()

    return output()
}

/** 
 * Advances the system to the next state by adding "w" to "i", giving "j" and
 * "k" their next values, and swapping "Spritz.i" and "Spritz.j". Since "w" is
 * relatively prime to "N", the value of "i" cycles modulo N as repeated updates
 * are performed.
 */
function update() {
    Spritz.i = _add(Spritz.i, Spritz.w)
    Spritz.j = _add(
        Spritz.k, Spritz.S[_add(
            Spritz.j, Spritz.S[Spritz.i]
        )]
    )
    Spritz.k = _add(
        Spritz.k + Spritz.i, Spritz.S[Spritz.j]
    )

    _swap(Spritz.S, Spritz.i, Spritz.j)
}

/**
 * Computes a syngle byte (N-value) to output, saves this value in register "z",
 * and returns tihs value.
 * @returns {number} - An unsigned random integer.
 */
function output() {
    Spritz.z = Spritz.S[_add(
        Spritz.j, Spritz.S[_add(
            Spritz.i, Spritz.S[_add(
                Spritz.z, Spritz.k
            )]
        )]
    )]

    // This countermeasure removes the bias in the Spritz keystream.
    // See https://www.jstage.jst.go.jp/article/transfun/E100.A/6/E100.A_1296/_article
    Spritz.z ^= Spritz.S[N - 1 - Spritz.i]

    return Spritz.z
}
