/* global describe, it, expect, beforeEach, afterEach, sinon */
var _ = require('underscore')
var createQueueThat = require('../../lib/queue-that')
describe('queueThat (functional)', function () {
  var queueThat

  beforeEach(function () {
    queueThat = createQueueThat({
      process: sinon.stub(),
      label: 'A label'
    })
  })

  afterEach(function () {
    queueThat.destroy()
    queueThat.storageAdapter.reset()
  })

  it('should debounce tasks', function (done) {
    queueThat.options.process = sinon.spy(function (items) {
      expect(items).to.eql(arrayWithoutRepeatedItems([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }]))
      done()
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
    }, 10)
  })

  it('should flush tasks when flush is called', function (done) {
    var callCount = 0
    queueThat.options.process = sinon.spy(function (items, next) {
      callCount++
      if (callCount === 1) {
        expect(items).to.eql(arrayWithoutRepeatedItems([{
          task: 'a'
        }, {
          task: 'b'
        }]))
        setTimeout(next, 50)
      }

      if (callCount === 2) {
        expect(items).to.eql(arrayWithoutRepeatedItems([{
          task: 'c'
        }]))
        done()
      }
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    queueThat.flush()

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
    }, 10)
  })

  it('should batch tasks', function (done) {
    queueThat.options.batchSize = 4

    queueThat.options.process = sinon.spy(function (items, next) {
      if (queueThat.options.process.callCount === 2) {
        check()
      } else {
        setTimeout(next, 10)
      }
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
      queueThat({
        task: 'd'
      })
      queueThat({
        task: 'e'
      })
    }, 10)

    function check () {
      expect(queueThat.options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }, {
        task: 'd'
      }]))

      expect(queueThat.options.process.getCall(1).args[0]).to.eql(arrayWithoutRepeatedItems([{
        task: 'e'
      }]))

      done()
    }
  })

  it('should retry tasks', function (done) {
    queueThat.options.batchSize = 4

    queueThat.options.process = sinon.spy(function (items, next) {
      if (queueThat.options.process.callCount === 1) {
        return setTimeout(function () {
          next(new Error('Failed'))
        }, 10)
      }
      if (queueThat.options.process.callCount === 3) {
        check()
      } else {
        setTimeout(next, 10)
      }
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
      queueThat({
        task: 'd'
      })
      queueThat({
        task: 'e'
      })
    }, 10)

    function check () {
      expect(queueThat.options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }, {
        task: 'd'
      }]))

      expect(queueThat.options.process.getCall(1).args[0]).to.eql(arrayWithRepeatedItems([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }, {
        task: 'd'
      }]))

      expect(queueThat.options.process.getCall(2).args[0]).to.eql(arrayWithoutRepeatedItems([{
        task: 'e'
      }]))

      done()
    }
  })

  describe('with two queues', function () {
    var anotherQueueThat
    beforeEach(function () {
      anotherQueueThat = createQueueThat({
        label: 'Another label',
        process: sinon.stub()
      })
    })

    afterEach(function () {
      anotherQueueThat.destroy()
      anotherQueueThat.storageAdapter.reset()
    })

    it('should work with two queues on the page', function (done) {
      this.timeout(10000)
      queueThat.options.process = sinon.spy(function (items, next) {
        if (queueThat.options.process.callCount !== 3) {
          return setTimeout(function () {
            next(new Error('Failed'))
          }, 10)
        } else {
          check()
        }
      })

      anotherQueueThat.options.process = sinon.spy(function (items, next) {
        if (anotherQueueThat.options.process.callCount === 1) {
          return setTimeout(function () {
            next(new Error('Failed'))
          }, 10)
        } else {
          check()
        }
      })

      queueThat('A')
      queueThat('B')
      queueThat('C')

      setTimeout(function () {
        queueThat('D')
        queueThat('E')

        anotherQueueThat('F')
        anotherQueueThat('G')
        anotherQueueThat('H')
        anotherQueueThat('I')
        anotherQueueThat('J')
      })

      function check () {
        var queueThatDone = queueThat.options.process.callCount === 3
        var anotherQueueThatDone = anotherQueueThat.options.process.callCount === 2
        if (queueThatDone && anotherQueueThatDone) {
          expect(queueThat.options.process.getCall(0).args[0]).to.eql(
            arrayWithoutRepeatedItems(['A', 'B', 'C', 'D', 'E'])
          )
          expect(queueThat.options.process.getCall(1).args[0]).to.eql(
            arrayWithRepeatedItems(['A', 'B', 'C', 'D', 'E'])
          )
          expect(queueThat.options.process.getCall(2).args[0]).to.eql(
            arrayWithRepeatedItems(['A', 'B', 'C', 'D', 'E'])
          )

          expect(anotherQueueThat.options.process.getCall(0).args[0]).to.eql(
            arrayWithoutRepeatedItems(['F', 'G', 'H', 'I', 'J'])
          )
          expect(anotherQueueThat.options.process.getCall(1).args[0]).to.eql(
            arrayWithRepeatedItems(['F', 'G', 'H', 'I', 'J'])
          )
          done()
        }
      }
    })
  })

  it('should trim tasks', function (done) {
    queueThat.options.trim = function (items) {
      return _.filter(items, function (item) {
        return item.task !== 'b'
      })
    }

    queueThat.options.process = sinon.spy(function (items) {
      expect(items).to.eql(arrayWithoutRepeatedItems([{
        task: 'a'
      }, {
        task: 'c'
      }]))
      done()
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'b'
      })
      queueThat({
        task: 'b'
      })
      queueThat({
        task: 'c'
      })
    }, 10)
  })

  describe('after a page is closed', function () {
    var freshQueueThat
    beforeEach(function (done) {
      this.timeout(5000)
      queueThat({
        task: 'a'
      })

      queueThat({
        task: 'b'
      })

      setTimeout(function () {
        queueThat.destroy()
      }, 200)

      setTimeout(function () {
        freshQueueThat = createQueueThat({
          process: sinon.stub(),
          label: 'A label'
        })
        done()
      }, 3000)
    })

    afterEach(function () {
      freshQueueThat.destroy()
      freshQueueThat.storageAdapter.reset()
    })

    it('should pick up old events and flag as repeated items', function (done) {
      freshQueueThat.options.process = sinon.spy(function (items) {
        expect(items).to.eql(arrayWithRepeatedItems([{
          task: 'a'
        }, {
          task: 'b'
        }]))

        queueThat.storageAdapter.reset()
        done()
      })
    })
  })
})

function arrayWithoutRepeatedItems (list) {
  list.containsRepeatedItems = false
  return list
}

function arrayWithRepeatedItems (list) {
  list.containsRepeatedItems = true
  return list
}
