const N = 256
const Spritz = {
    i: 0,
    j: 0,
    k: 0,
    a: 0,
    w: 1,
    z: 0,
    state: Array.from(Array(N), (_, v) => v)
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

function absorb(I) {
    for (let v = 0; v < I.length; v++) {
        absorbByte(I[v])
    }
}

function absorbByte(b) {
    absorbNibble(b & 0xf) // low
    absorbNibble(b >> 4)  // high
}

function absorbNibble(x) {
    if (Spritz.a >= Math.floor(N / 2)) {
        shuffle()
    }

    _swap(Spritz.state, Spritz.a, _add(Math.floor(N / 2), x))

    Spritz.a += 1
}

function absorbStop() {
    if (Spritz.a >= Math.floor(N / 2)) {
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
    for (let v = 0; v < r; v++) {
        update()
    }

    do {
        Spritz.w += 1
    } while (_gcd(Spritz.w, N) !== 1)
}

function crush() {
    for (let v = 0; v < Math.floor(N / 2); v++) {
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

    for (let v = 0; v < r; v++) {
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
