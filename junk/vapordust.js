const regl = require('regl')({
  extensions: 'OES_texture_float'
})

const N = 256

const initialPosition = Array(N).fill().map((_, i) =>
  Array(N).fill().map((_, j) => [
    i,
    j,
    i,
    j
  ]))

const squareState = Array(2).fill().map(() =>
  regl.framebuffer({
    color: regl.texture({
      data: initialPosition,
      type: 'float',
      wrap: 'mirror'
    }),
    depthStencil: false
  }))

const updateSquare = regl({
  frag: `
  precision highp float;
  uniform sampler2D state;
  uniform vec2 delta;
  varying vec2 uv;

  void main () {
    vec4 s = texture2D(state, uv);

    vec2 sr = texture2D(state, uv + vec2(delta.x, 0)).xy;
    vec2 sl = texture2D(state, uv - vec2(delta.x, 0)).xy;
    vec2 su = texture2D(state, uv + vec2(0, delta.y)).xy;
    vec2 sd = texture2D(state, uv - vec2(0, delta.y)).xy;

    vec2 p1 = s.xy;
    vec2 p0 = s.zw;

    vec2 d = 0.25 * (sr + sl + su + sd) - p1;
    float l = length(d);

    float f = l - 1.0;

    vec2 n = 2.0 * p1 - p0 + 0.1 * d / max(0.001, l) * f;
    gl_FragColor = vec4(n, p1);
  }
  `,

  vert: `
  precision highp float;
  attribute vec2 position;
  varying vec2 uv;
  void main () {
    uv = 0.5 * vec2(position.x + 1.0, 1.0 - position.y);
    gl_Position = vec4(position, 0, 1);
  }
  `,

  attributes: {
    position: [
      -4, 0,
      4, 4,
      4, -4
    ]
  },

  uniforms: {
    state: ({tick}) => squareState[(tick + 1) % 2],
    delta: [1.0 / (N - 1), 1.0 / (N - 1)]
  },

  framebuffer: ({tick}) => squareState[tick % 2],

  depth: {
    enable: false,
    mask: false
  },

  blend: {
    enable: false
  },

  count: 3
})

const drawSquare = regl({
  frag: `
  precision highp float;
  varying vec2 fuv;
  void main () {
    gl_FragColor = vec4(fuv, 1, 1);
  }
  `,
  vert: `
  precision highp float;
  attribute vec2 uv;
  uniform sampler2D state;
  varying vec2 fuv;
  void main () {
    fuv = uv;
    gl_PointSize = 4.0;
    vec2 p = texture2D(state, uv).xy / float(${N});

    gl_Position = vec4(2.0 * (p - floor(p)) - 1.0, 0, 1);
  }
  `,
  attributes: {
    uv: (() => {
      const uv = []
      for (let i = 0; i < N; ++i) {
        for (let j = 0; j < N; ++j) {
          uv.push([(i + 0.5) / N, (j + 0.5) / N])
        }
      }
      return uv
    })()
  },
  uniforms: {
    state: ({tick}) => squareState[tick % 2]
  },
  count: N * N,
  primitive: 'points'
})

const feedbackTex = regl.texture({
  copy: true
})

const drawFeedback = regl({
  frag: `
  precision highp float;
  uniform sampler2D screen;
  uniform vec2 delta;
  varying vec2 uv;

  void main () {
    vec4 s = texture2D(screen, uv - 0.01 * (uv - 0.5));
    gl_FragColor = vec4(0.99 * s.rgb, 1);
  }
  `,

  vert: `
  precision highp float;
  attribute vec2 position;
  varying vec2 uv;
  void main () {
    uv = 0.5 * vec2(position.x + 1.0, 1.0 - position.y);
    gl_Position = vec4(position, 0, 1);
  }
  `,

  attributes: {
    position: [
      -4, 0,
      4, 4,
      4, -4
    ]
  },

  uniforms: {
    screen: feedbackTex,
    delta: ({viewportWidth, viewportHeight}) =>
      [1 / viewportWidth, 1 / viewportHeight]
  },

  depth: {
    enable: false,
    mask: false
  },

  count: 3
})

regl.frame(() => {
  regl.clear({
    depth: 1
  })

  updateSquare()
  drawFeedback()
  drawSquare()
  feedbackTex({copy: true})
})
