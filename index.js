const fuse = require('fuse-bindings')
const Nanoresource = require('nanoresource')
const path = require('path')
const mkdirp = require('mkdirp')

const EMPTY = Buffer.alloc(512)

module.exports = (mnt, name, opts) => new BlockDevice(mnt, name, opts)

class BlockDevice extends Nanoresource {
  constructor (mnt, opts) {
    super()

    if (!opts || !opts.read) throw new Error('opts.read(index, cb) is required')
    if (!opts || !opts.write) throw new Error('opts.write(index, block, cb) is required')

    this.mnt = path.dirname(mnt)
    this.name = path.basename(mnt)
    this.path = mnt
    this.size = opts.size || 4 * 1024 * 1024 * 1024
    this.ctime = new Date()
    this.mtime = this.ctime

    this.uid = opts.uid || (process.getuid ? process.getuid() : 0)
    this.gid = opts.gid || (process.getgid ? process.getgid() : 0)
    this.blockSize = 512
    this.EMPTY = EMPTY
    this.options = opts.options || []
    this.files = [ this.name ]

    this.onread = opts.read
    this.onwrite = opts.write
    this.onerror = opts.error || noop
    this.onmount = opts.mount || noop
    this.onunmount = opts.unmount || noop

    this.open()
  }

  _open (cb) {
    const self = this

    const ops = {
      force: true,
      options: self.options,
      readdir (path, cb) {
        if (path === '/') return cb(0, self.files)
        cb(0)
      },
      chown (path, uid, gid, cb) {
        cb(0)
      },
      utimens (path, atime, mtime, cb) {
        cb(0)
      },
      truncate (path, size, cb) {
        cb(0)
      },
      getattr (path, cb) {
        if (path === '/') return cb(0, self._stat(100, 0o40755))
        if (path === '/' + self.name) return cb(0, self._stat(self.size, 0o100644))
        if (hasLock(path)) return cb(0, self._stat(0, 0o100644))
        cb(fuse.ENOENT)
      },
      create (path, mode, cb) {
        ops.open(path, mode, cb)
      },
      open (path, flags, cb) {
        if (path === '/' + self.name) return cb(0, 42)
        if (hasLock(path)) return cb(0, 43)

        if (/\.lck$/.test(path)) {
          self.files.push(path.split('/').pop())
          return cb(0, 44)
        }

        cb(0, fuse.ENOENT)
      },
      read (path, fd, buf, len, pos, cb) {
        if (hasLock(path)) return cb(0)
        if ((pos & 511) || (len & 511)) return cb(fuse.EINVAL)
        if (!len) return cb(0)

        const blk = pos / 512
        const cnt = len / 512

        if (!self.active()) return cb(fuse.ESPIPE)
        self.onread(blk, cnt, buf, function (err) {
          self.inactive()
          if (err) return cb(fuse.ESPIPE) // open for better error
          cb(len)
        })
      },
      write (path, fd, buf, len, pos, cb) {
        if (hasLock(path)) return cb(0)
        if ((pos & 511) || (len & 511)) return cb(fuse.EINVAL)
        if (!len) return cb(0)

        const blk = pos / 512
        const cnt = len / 512

        if (!self.active()) return cb(fuse.ESPIPE)
        self.onwrite(blk, cnt, buf, function (err) {
          self.inactive()
          if (err) return cb(fuse.ESPIPE)
          cb(len)
        })
      },
      release (path, fd, cb) {
        cb(0)
      }
    }

    function hasLock (path) {
      return /\.lck$/.test(path) && self.files.indexOf(path.slice(1)) > -1
    }

    mkdirp(this.mnt, function () {
      fuse.mount(self.mnt, ops, function (err) {
        if (err) return onerror(err)
        self.onmount()
        cb(null)
      })

      function onerror (err) {
        self.onerror(err)
        cb(err)
      }
    })
  }

  _close (cb) {
    const self = this

    fuse.unmount(this.mnt, function (err) {
      if (!err) self.onunmount()
      cb(err)
    })
  }

  _stat (size, mode) {
    return {
      ctime: this.ctime,
      mtime: this.mtime,
      atime: this.mtime,
      nlink: 1,
      size,
      mode,
      uid: this.uid,
      gid: this.gid
    }
  }
}

function noop () {}
