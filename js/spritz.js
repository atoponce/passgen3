let N = 256
let Spritz = {
    i: 0,
    j: 0,
    k: 0,
    a: 0,
    w: 1,
    z: 0,
    state: Array.from(Array(N), (_, i) => i)
}

function _swap(arr, x, y) {
    return [arr[x], arr[y]] = [arr[y], arr[x]]
}

function _add(x, y) {
    return (x + y) & 0xff
}

function _gcd(x, y) {
    if (!y) {
        return x
    }

    return _gcd(y, x % y)
}

function absorb(data) {
    for (let byte = 0; byte < data.length; byte++) {
        absorbByte(data[byte])
    }
}

function absorbByte(byte) {
    absorbNibble(byte & 0xf) // low
    absorbNibble(byte >> 4)  // high
}

function absorbNibble(nibble) {
    if (Spritz.a >= N / 2) {
        shuffle()
    }

    _swap(Spritz.state, Spritz.a, _add(N / 2, nibble))

    Spritz.a += 1
}

function absorbStop() {
    if (Spritz.a >= N / 2) {
        shuffle()
    }

    Spritz.a += 1
}

function shuffle() {
    whip(2 * N)
    crush()
    whip(2 * N)
    crush()
    whip(2 * N)
    Spritz.a = 0
}

function whip(r) {
    for (let i = 0; i < r; i++) {
        update()
    }

    do {
        Spritz.w += 1
    } while (_gcd(Spritz.w, N) != 1)
}

function crush() {
    for (let v = 0; v < N / 2; v++) {
        if (Spritz.state[v] > Spritz.state[255 - v]) {
            _swap(Spritz.state, v, 255 - v)
        }
    }
}

function squeeze(r) {
    if (Spritz.a > 0) {
        shuffle()
    }

    let p = []

    for (let i = 0; i < r; i++) {
        p.push(drip())
    }

    return p
}

function drip() {
    if (Spritz.a > 0) {
        shuffle()
    }

    update()

    return output()
}

function update() {
    Spritz.i = _add(Spritz.i, Spritz.w)
    Spritz.j = _add(
        Spritz.k, Spritz.state[_add(
            Spritz.j, Spritz.state[Spritz.i]
        )]
    )
    Spritz.k = _add(
        Spritz.k + Spritz.i, Spritz.state[Spritz.j]
    )

    _swap(Spritz.state, Spritz.i, Spritz.j)
}

function output() {
    Spritz.z = Spritz.state[_add(
        Spritz.j, Spritz.state[_add(
            Spritz.i, Spritz.state[_add(
                Spritz.z, Spritz.k
            )]
        )]
    )]

    return Spritz.z
}
