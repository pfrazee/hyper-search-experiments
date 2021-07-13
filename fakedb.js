export class FakeDB {
  constructor () {
    this.kvs = {}
  }

  batch () {
    return {
      put: (key, value) => {
        this.kvs[key] = value
      },
      async flush () {}
    }
  }

  get (key) {
    return this.kvs[key]
  }

  async list ({lt, gt}) {
    return Object.entries(this.kvs).map(([key, value]) => ({key, value})).filter(item => {
      // console.log(item.key, 'vs', lt, item.key.localeCompare(lt), gt, item.key.localeCompare(gt))
      if (item.key.localeCompare(lt) >= 0) return false
      if (item.key.localeCompare(gt) <= 0) return false
      return true
    })
  }
}