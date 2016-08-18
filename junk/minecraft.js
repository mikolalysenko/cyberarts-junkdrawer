const regl = require('regl')()
const mouse = require('mouse-change')()
const ndarray = require('ndarray')
const mat4 = require('gl-mat4')
const computeMesh = require('ao-mesher')
const pool = require('typedarray-pool')
const fill = require('ndarray-fill')
const terrain = require('isabella-texture-pack')

const WORLD_SIZE = 64
const CHUNK_SIZE = 16
const CHUNK_DIMS = WORLD_SIZE / CHUNK_SIZE
const CHUNK_BUFFER_MAX = Math.pow(CHUNK_SIZE, 3) * 3 * 12 * 8

const voxels = ndarray(
  new Uint16Array(8 * WORLD_SIZE * WORLD_SIZE * WORLD_SIZE),
  [
    WORLD_SIZE + 2,
    WORLD_SIZE + 2,
    WORLD_SIZE + 2
  ])

fill(voxels, (i, j, k) => {
  if (j < WORLD_SIZE / 4) {
    return (1 << 15) + 1
  }
  if (i + j + k < 32) {
    return (1 << 15) + 3
  }
  if (Math.max(Math.abs(i - 16), Math.abs(j - 16), Math.abs(k - 16)) < 4) {
    return (1 << 15) + 17
  }
  return 0
})

const chunks = ndarray(
  voxels.data,
  [
    CHUNK_DIMS, CHUNK_DIMS, CHUNK_DIMS,
    CHUNK_SIZE + 2, CHUNK_SIZE + 2, CHUNK_SIZE + 2
  ],
  [
    voxels.stride[0] * (CHUNK_SIZE),
    voxels.stride[1] * (CHUNK_SIZE),
    voxels.stride[2] * (CHUNK_SIZE),
    voxels.stride[0],
    voxels.stride[1],
    voxels.stride[2]
  ],
  0)

const CHUNKS = {}
const CHUNK_LIST = []

function Chunk (x, y, z) {
  this.id = x + ':' + y + ':' + z
  this.x = x
  this.y = y
  this.z = z
  this.offset = [CHUNK_SIZE * x, CHUNK_SIZE * y, CHUNK_SIZE * z]
  this.data = chunks.pick(x, y, z)
  this.buffer = regl.buffer(CHUNK_BUFFER_MAX)
  this.vertCount = 0
  this.attrib0 = {
    buffer: this.buffer,
    stride: 8,
    offset: 0
  }
  this.attrib1 = {
    buffer: this.buffer,
    stride: 8,
    offset: 4
  }
  CHUNKS[this.id] = this
}

Chunk.prototype.mesh = function () {
  const verts = computeMesh(this.data)
  if (verts) {
    this.buffer.subdata(verts)
    this.vertCount = verts.length / 8
    pool.free(verts)
  } else {
    this.vertCount = 0
  }
}

const drawChunks = regl({
  vert: `
  attribute vec4 attrib0, attrib1;

  uniform mat4 projection, view;
  uniform vec3 offset;
  uniform float tileCount;

  varying vec3  normal;
  varying vec2  tileCoord;
  varying vec2  texCoord;
  varying float ambientOcclusion;

  void main() {
    //Compute position
    vec3 position = attrib0.xyz;

    //Compute ambient occlusion
    ambientOcclusion = attrib0.w / 255.0;

    //Compute normal
    normal = 128.0 - attrib1.xyz;

    //Compute texture coordinate
    texCoord = vec2(dot(position, vec3(normal.y-normal.z, 0, normal.x)),
                    dot(position, vec3(0, -abs(normal.x+normal.z), normal.y)));

    //Compute tile coordinate
    float tx    = attrib1.w / tileCount;
    tileCoord.x = floor(tx);
    tileCoord.y = fract(tx) * tileCount;

    gl_Position = projection * view * vec4(position + offset, 1.0);
  }`,

  frag: `
  precision highp float;

  uniform float tileSize;
  uniform sampler2D tileMap;
  uniform float tileCount;

  varying vec3  normal;
  varying vec2  tileCoord;
  varying vec2  texCoord;
  varying float ambientOcclusion;

  void main() {

    vec2 uv      = texCoord;
    vec4 color   = vec4(0,0,0,0);
    float weight = 0.0;

    vec2 tileOffset = 2.0 * tileSize * tileCoord;
    float denom     = 2.0 * tileSize * tileCount;

    for(int dx=0; dx<2; ++dx) {
      for(int dy=0; dy<2; ++dy) {
        vec2 offset = 2.0 * fract(0.5 * (uv + vec2(dx, dy)));
        float w = pow(1.0 - max(abs(offset.x-1.0), abs(offset.y-1.0)), 16.0);

        vec2 tc = (tileOffset + tileSize * offset) / denom;
        color  += w * texture2D(tileMap, tc);
        weight += w;
      }
    }
    color /= weight;

    if(color.w < 0.5) {
      discard;
    }

    float light = ambientOcclusion + max(0.15*dot(normal, vec3(1,1,1)), 0.0);

    gl_FragColor = vec4(color.xyz * light, 1.0);
  }`,

  attributes: {
    attrib0: regl.prop('attrib0'),
    attrib1: regl.prop('attrib1')
  },

  count: regl.prop('vertCount'),

  uniforms: {
    view: regl.context('view'),
    projection: regl.context('projection'),
    offset: regl.prop('offset'),
    tileMap: regl.texture(terrain),
    tileSize: 16,
    tileCount: 16
  },
  elements: null,
  primitive: 'triangles'
})

function Camera () {
  this.projection = new Float32Array(16)
  this.view = new Float32Array(16)
}

Object.assign(Camera.prototype, {
  setup: regl({
    context: {
      projection: function ({viewportWidth, viewportHeight}) {
        return mat4.perspective(this.projection,
          Math.PI / 4.0,
          viewportWidth / viewportHeight,
          0.01,
          1000.0)
      },
      view: function ({
        tick,
        drawingBufferWidth,
        drawingBufferHeight,
        pixelRatio}) {
        const x = 2.0 * pixelRatio * mouse.x / drawingBufferWidth - 1.0
        const y = 1.0 - 2.0 * pixelRatio * mouse.y / drawingBufferHeight
        return mat4.lookAt(this.view,
          [
            2.0 * voxels.shape[0] * Math.cos(x * Math.PI) + 0.5 * voxels.shape[0],
            voxels.shape[1] * (y + 1.0),
            2.0 * voxels.shape[0] * Math.sin(x * Math.PI) + 0.5 * voxels.shape[2]
          ],
          [ 16, 16, 16 ],
          [ 0, 1, 0 ])
      }
    }
  })
})

const camera = new Camera()

for (let i = 0; i < chunks.shape[0]; ++i) {
  for (let j = 0; j < chunks.shape[1]; ++j) {
    for (let k = 0; k < chunks.shape[2]; ++k) {
      CHUNK_LIST.push(new Chunk(i, j, k))
    }
  }
}

CHUNK_LIST.forEach((c) => c.mesh())

function setVoxel (i, j, k, b) {
  voxels.set(i, j, k, b)
  const index =
    chunks.shape[0] * (Math.floor(i / 16) +
    chunks.shape[1] * (Math.floor(j / 16) +
    Math.floor(k / 16)))
  CHUNK_LIST[index].mesh()
}

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })
  camera.setup(() => {
    drawChunks(CHUNK_LIST)
  })
})
