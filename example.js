const blockDevice = require('./')

const blocks = new Map()

const blk = blockDevice('./mnt/4gb', {
  uid: 1000,
  gid: 1000,
  options: process.getuid() ? [] : [ 'allow_other' ],
  read (index, cnt, buf, cb) {
    for (let i = 0; i < cnt; i++) {
      const b = blocks.get(index + i) || blk.EMPTY
      b.copy(buf, i * 512)
    }
    cb(null)
  },
  write (index, cnt, buf, cb) {
    for (let i = 0; i < cnt; i++) {
      const b = blocks.get(index + i) || Buffer.alloc(512)
      buf.copy(b, 0, i * 512)
      blocks.set(index + i, b)
    }
    cb(null)
  },
  mount () {
    console.log('device mounted')
  },
  error (err) {
    console.log('error', err)
  }
})

process.once('SIGINT', () => blk.close())
