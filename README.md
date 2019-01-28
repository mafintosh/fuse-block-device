# fuse-block-device

A virtual block device backed by FUSE

```
npm install fuse-block-device
```

## Usage

``` js
const blockDevice = require('fuse-block-device')

const device = blockDevice('./mnt/4gb', {
  read (index, blocks, buffer, cb) {
    // Read {blocks} x 512 blocks into {buffer} from some storage
    cb(null)
  },
  write (index, blocks, buffer, cb) {
    // Store {blocks} x 512 from {buffer} into some storage
    cb(null)
  }
})
```

You can use a block device to create various file systems on top.

Try running the example from the repo (that implements an in-memory block device)
and make an ext4 file system on top:

``` sh
# cd fuse-block-device
node example.js
# in another shell in the same folder
mkfs.ext4 ./mnt/4gb # creates an ext4 file system on the block device \o/
```

## API

#### `const device = blockDevice(mountPoint, [options])`

Create a new virtual block device.

Options include

``` js
{
  size: fixedFixedOfTheDevice, // must be divisable by 512
  read: (index, blockCount, buffer, cb), // called when the device wants to read blocks
  write: (index, blockCount, buffer, cb), // called when the device wants to write blocks
  mount: (), // called when the device is fully mounted
  error: (err), // called if the device experienced an error during mount
  uid: process.getuid(), // optionally set the uid of the block device
  gid: process.getgid(), // optionally set the gid of the block device
  options: [ ... ], // fuse mount options that are forwarded
}
```

Each stored block is 512 bytes, but note that your write/read method might be called with more than
one block at the time.

#### `device.close([callback])`

Fully close the block device. You should call this before shutting down the program to nicely unmount it first.

#### `device.open([callback])`

Optionally you can call this to be notificed when the device is mounted.

## License

MIT
