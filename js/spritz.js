let Spritz = {
    i: 0,
    j: 0,
    k: 0,
    a: 0,
    w: 1,
    z: 0,
    state: Array.from(Array(256), (_, i) => i)
}

function _swap(arr, x, y) {
    return [arr[x], arr[y]] = [arr[y], arr[x]]
}

function _add(x, y) {
    return (x + y) & 0xff
}

function absorb(data) {
    for (let byte = 0; byte < data.length; byte++) {
        absorbByte(data[byte])
    }
}

function absorbByte(byte) {
    absorbNibble(byte & 0xf)
    absorbNibble(byte >> 4)
}

function absorbNibble(nibble) {
    if (Spritz.a >= 128) {
        shuffle()
    }

    _swap(Spritz.state, Spritz.a, _add(128, nibble))

    Spritz.a += 1
}

function absorbStop() {
    if (Spritz.a[0] >= 128) {
        shuffle()
    }

    Spritz.a += 1
}

function shuffle() {
    whip()
    crush()
    whip()
    crush()
    whip()
    Spritz.a = 0
}

function whip() {
    for (let i = 0; i < 512; i++) {
        update()
    }

    Spritz.w = _add(Spritz.w, 2)
}

function crush() {
    for (let v = 0; v < 128; v++) {
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
