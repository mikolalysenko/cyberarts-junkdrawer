const regl = require('regl')({
  extensions: 'OES_texture_float'
})
const camera = require('../regl-camera')(regl, {
  center: [0, 0, 0],
  minDistance: 5,
  maxDistance: 5
})

const LOG_N = 4
const N = (1 << LOG_N)
const COUNT = N * N

const curState = new Float32Array(COUNT * 4)
const prevState = new Float32Array(COUNT * 4)
for (let i = 0; i < COUNT * 4; ++i) {
  const x = 2.0 * Math.random() - 1.0
  curState[i] = x
  prevState[i] = x
}

const particleTexture = regl.texture({
  type: 'float',
  shape: [N, N, 4],
  data: curState
})

const drawParticles = regl({
  frag: `
  precision highp float;

  void main () {
    float opacity = step(length(gl_PointCoord.xy - 0.5), 0.5);
    gl_FragColor = 0.25 * opacity * vec4(1, 1, 1, 1);
  }
  `,

  vert: `
  precision highp float;

  uniform sampler2D particleState;
  uniform float pointSize;
  uniform mat4 projection, view;
  attribute vec2 id;

  void main () {
    vec4 state = texture2D(particleState, id);
    gl_PointSize = pointSize;
    gl_Position = projection * view * vec4(state.xyz, 1);
  }
  `,

  uniforms: {
    pointSize: ({pixelRatio}) => pixelRatio * 8.0,
    particleState: particleTexture
  },

  attributes: {
    id: Array(N * N).fill().map((_, i) => [(i % N) / N, ((i / N) | 0) / N])
  },

  blend: {
    enable: true,
    func: {
      src: 1,
      dst: 1
    },
    equation: 'add'
  },

  depth: {
    enable: false,
    mask: false
  },

  count: N * N,

  primitive: 'points'
})

const drawPairs = regl({
  frag: `
  precision highp float;

  varying float intensity;

  void main () {
    gl_FragColor = intensity * vec4(1, 1, 1, 1);
  }
  `,

  vert: `
  precision highp float;

  uniform sampler2D particleState;
  uniform float radius;
  uniform mat4 projection, view;
  attribute vec4 id;

  varying float intensity;

  void main () {
    vec3 p0 = texture2D(particleState, id.xy).xyz;
    vec3 p1 = texture2D(particleState, id.zw).xyz;

    float d = length(p0 - p1);
    intensity = 1.0;

    gl_Position = step(d, radius) * projection * view * vec4(p0.xyz, 1);
  }
  `,

  uniforms: {
    particleState: particleTexture,
    radius: regl.prop('radius')
  },

  attributes: {
    id: () => {
      const pairs = []
      for (let i = 1; i < N * N; ++i) {
        const px = (i % N) / N
        const py = ((i / N) | 0) / N
        for (let j = 0; j < i; ++j) {
          const qx = (j % N) / N
          const qy = ((j / N) | 0) / N
          pairs.push(
            px, py, qx, qy,
            qx, qy, px, py)
        }
      }
      return pairs
    }
  },

  blend: {
    enable: false
  },

  depth: {
    enable: false,
    mask: false
  },

  count: N * N * (N * N - 1),

  primitive: 'lines'
})

const drawTriples = regl({
  frag: `
  precision highp float;
  varying float intensity;
  void main () {
    gl_FragColor = intensity * vec4(1, 1, 1, 1);
  }
  `,

  vert: `
  precision highp float;

  uniform sampler2D particleState;
  uniform float radius;
  uniform mat4 projection, view;
  attribute vec2 id0, id1, id2;

  varying float intensity;

  void main () {
    vec3 p0 = texture2D(particleState, id0).xyz;
    vec3 p1 = texture2D(particleState, id1).xyz;
    vec3 p2 = texture2D(particleState, id2).xyz;

    float d = max(max(length(p0 - p1), length(p2 - p1)), length(p0 - p2));
    intensity = 0.125;

    gl_Position = projection * view * step(d, radius) * vec4(p0, 1);
  }
  `,

  uniforms: {
    particleState: particleTexture,
    radius: regl.prop('radius')
  },

  attributes: (() => {
    const triples = []
    for (let i = 2; i < N * N; ++i) {
      const px = (i % N) << (8 - LOG_N)
      const py = ((i / N) | 0) << (8 - LOG_N)
      for (let j = 1; j < i; ++j) {
        const qx = (j % N) << (8 - LOG_N)
        const qy = ((j / N) | 0) << (8 - LOG_N)
        for (let k = 0; k < j; ++k) {
          const rx = (k % N) << (8 - LOG_N)
          const ry = ((k / N) | 0) << (8 - LOG_N)
          triples.push(
            px, py, qx, qy, rx, ry,
            qx, qy, rx, ry, px, py,
            rx, ry, px, py, qx, qy)
        }
      }
    }
    const buffer = regl.buffer(new Uint8Array(triples))
    return {
      id0: {
        buffer: buffer,
        offset: 0,
        stride: 6,
        normalized: true,
        type: 'uint8'
      },
      id1: {
        buffer: buffer,
        offset: 2,
        stride: 6,
        normalized: true,
        type: 'uint8'
      },
      id2: {
        buffer: buffer,
        offset: 4,
        stride: 6,
        normalized: true,
        type: 'uint8'
      }
    }
  })(),

  blend: {
    enable: true,
    func: {
      src: 1,
      dst: 1
    },
    equation: 'add'
  },

  depth: {
    enable: false,
    mask: false
  },

  count: N * N * (N * N - 1) * (N * N - 2) / 2,

  primitive: 'triangles'
})

function field (x, y, z, d) {
  return 0.1 * (Math.sin((d + 1) * x) * Math.cos(3.0 * y) + z * z)
}

function updateParticles () {
  const h = 1e-4
  for (let i = 0; i < COUNT; ++i) {
    const cx = curState[4 * i]
    const cy = curState[4 * i + 1]
    const cz = curState[4 * i + 2]

    const px = prevState[4 * i]
    const py = prevState[4 * i + 1]
    const pz = prevState[4 * i + 2]

    const dfzdy = 0.5 * (field(cx, cy + h, cz, 2) - field(cx, cy - h, cz, 2))
    const dfydz = 0.5 * (field(cx, cy, cz + h, 1) - field(cx, cy, cz - h, 1))

    const dfxdz = 0.5 * (field(cx, cy, cz + h, 0) - field(cx, cy, cz - h, 0))
    const dfzdx = 0.5 * (field(cx + h, cy, cz, 2) - field(cx - h, cy, cz, 2))

    const dfydx = 0.5 * (field(cx + h, cy, cz, 1) - field(cx - h, cy, cz, 1))
    const dfxdy = 0.5 * (field(cx, cy + h, cz, 0) - field(cx, cy - h, cz, 0))

    const fc = 0.001 * Math.log(Math.pow(cx, 2) + Math.pow(cy, 2) + Math.pow(cz, 2))

    curState[4 * i] = 2.0 * cx - px + (dfzdy - dfydz) - fc * cx
    curState[4 * i + 1] = 2.0 * cy - py + (dfxdz - dfzdx) - fc * cy
    curState[4 * i + 2] = 2.0 * cz - pz + (dfydx - dfxdy) - fc * cz

    prevState[4 * i] = cx
    prevState[4 * i + 1] = cy
    prevState[4 * i + 2] = cz
  }
}

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1]
  })

  updateParticles()
  particleTexture.subimage(curState)

  camera(() => {
    drawTriples({
      radius: 0.25
    })
    drawPairs({
      radius: 0.25
    })
    drawParticles()
  })
})
