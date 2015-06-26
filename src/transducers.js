define(function () {
    /** @const */
    var DEBUG = false;
    /** @const */
    var MISUSE_CHECK = DEBUG || false;
    /** @const */
    var CHECK_CYCLES = DEBUG || false;
    /** @const */
    var DEBUG_SIGNALS = DEBUG || false;
    /** @const */
    var SIMULATE_RANDOM_ERRORS_IN_SIGNAL = false;
    function log() {
        console.log.apply(console, arguments);
    }
    ;
    function id(v) {
        return v;
    }
    function nop() {
    }
    function assert(cond, msg) {
        if (!(cond))
            throw new Error('Assert fail: ' + msg);
    }
    function arrayReducer(s) {
        s = s || [];
        return inherit({
            b: function () {
                DEBUG && log('.b on arrayReducer:', s);
                return s;
            }
        }, function (v) {
            s.push(v);
        });
    }
    function objReducer(s) {
        s = s || {};
        return inherit({ b: function () { return s; } }, function (v) { return objMerge(v, s); });
    }
    var protocolIterator = typeof Symbol === 'undefined' ? '@@iterator' : Symbol.iterator;
    function unspool(coll) {
        if (coll[protocolIterator]) {
            return coll[protocolIterator].call(coll);
        }
        else if (Array.isArray(coll)) {
            return {
                to: function (r) {
                    coll.some(r);
                    r.b && r.b(true);
                },
            };
        }
        return coll; // Iterators and Unspool implement Unspool
    }
    function range(min, max) {
        if (max === void 0) {
            max = min;
            min = 0;
        }
        var i = {};
        i[protocolIterator] = function () {
            var n = min;
            return {
                next: function () {
                    return n++ < max ? { value: n } : { done: true };
                }
            };
        };
        return i;
    }
    function objBind(coll, f) {
        return Object.keys(coll).some(function (k) { return f([k, coll[k]]); });
    }
    function objMerge(src, dest) {
        if (Array.isArray(src)) {
            dest[src[0]] = src[1];
        }
        else {
            objBind(src, function (v) { return objMerge(v, dest); });
        }
    }
    function feed(coll, reducer) {
        var u = unspool(coll);
        if (u.to) {
            u.to(reducer);
        }
        else {
            var val, c;
            for (; val = u.next(), !(c || val.done);) {
                c = reducer(val.value);
            }
            reducer.b && reducer.b(true);
        }
    }
    function inherit(reducer, f) {
        if (reducer.b)
            f.b = reducer.b;
        return f;
    }
    function reducep(f) {
        return function (reducer) {
            return inherit(reducer, function (input) {
                f(input);
                return reducer(f.b(true));
            });
        };
    }
    function map(f) {
        return function (reducer) {
            return inherit(reducer, function (input) {
                return reducer(f(input));
            });
        };
    }
    function filter(f) {
        return function (reducer) {
            return inherit(reducer, function (input) {
                return f(input) && reducer(input);
            });
        };
    }
    function take(n) {
        return function (reducer) {
            var l = n;
            return inherit(reducer, function (input) {
                return --l < 0 || reducer(input) || !l;
            });
        };
    }
    function drop(n) {
        return function (reducer) {
            var l = n;
            return inherit(reducer, function (input) {
                return --l < 0 && reducer(input);
            });
        };
    }
    function takeWhile(f) {
        return function (reducer) {
            return inherit(reducer, function (input) {
                return !f(input) || reducer(input);
            });
        };
    }
    function dropWhile(f) {
        return function (reducer) {
            var f2 = f;
            return inherit(reducer, function (input) {
                // This works because reducer(input) will return a falsy value
                // if this reducer may be called again.
                return !(f2 && f2(input)) && (f2 = reducer(input));
            });
        };
    }
    function fold(f) {
        return function (s) {
            return inherit({
                b: function () { return s; }
            }, function (input) { return s = f(s, input); });
        };
    }
    // Reducers
    function groupBy(f) {
        return function () {
            var groups = {};
            return inherit({
                b: function () { return groups; }
            }, function (input) {
                var k = f(input);
                (groups[k] = groups[k] || []).push(input);
            });
        };
    }
    function some(f) {
        return function () {
            var v;
            return inherit({
                b: function () { return v; }
            }, function (input) {
                return v = !f || f(input);
            });
        };
    }
    function first(f) {
        return function () {
            var v;
            return inherit({
                b: function () { return v; }
            }, function (input) {
                if (!f || f(input)) {
                    v = input;
                    return true;
                }
            });
        };
    }
    function wait(reducer) {
        var o = 1, lastEndcond = true;
        // TODO: Combine errors better
        return inherit({
            b: function (endcond) {
                DEBUG && log('.b on wait:', o - 1);
                if (endcond !== true)
                    lastEndcond = endcond;
                if (!--o) {
                    return reducer.b && reducer.b(lastEndcond);
                }
            }
        }, function () {
            ++o;
            return inherit({
                b: function (endcond) {
                    DEBUG && log('.b on wait:', o - 1);
                    if (endcond !== true)
                        lastEndcond = endcond;
                    if (!--o) {
                        return reducer.b && reducer.b(lastEndcond);
                    }
                }
            }, function (input) { return reducer(input); });
        });
    }
    function latest() {
        return function (next) {
            var cur = 0;
            return inherit(next, function () {
                var wrapped = next();
                var me = ++cur;
                return inherit(wrapped, function (input) {
                    return cur ^ me || wrapped(input);
                });
            });
        };
    }
    function ordered() {
        return function (next) {
            var tail = 0, queue = [], head = 0;
            return inherit(next, function () {
                var wrapped = next(), me = tail++, arr = [];
                return inherit({
                    b: function (endcond) {
                        queue[me] = function () {
                            arr.some(wrapped);
                            wrapped.b();
                            queue[me] = null;
                        };
                        while (queue[head])
                            queue[head++]();
                    }
                }, function (input) {
                    arr.push(input);
                    if (me == head) {
                        var r = arr.some(wrapped);
                        arr = [];
                        return r;
                    }
                });
            });
        };
    }
    // Concatenate a sequence of reducible objects into one sequence
    function cat(join) {
        return function (reducer) {
            var r = wait(reducer);
            if (join)
                r = join.f(r);
            return inherit(r, function (input) {
                feed(input, r());
                return;
            });
        };
    }
    function match(coll) {
        return function (reducer) {
            return inherit(reducer, function (input) {
                var c;
                coll.some(function (x) {
                    var v = x(input);
                    return (v !== void 0) && (c = reducer(v), true);
                });
                return c;
            });
        };
    }
    function every(interval) {
        var s = sig();
        function set() {
            setTimeout(function () {
                s.r(1) || set();
            }, interval);
        }
        set();
        return s;
    }
    function after(ms, v) {
        var s = sig();
        DEBUG && log('calling after, ms =', ms);
        setTimeout(function () {
            DEBUG && log('triggering after');
            if (SIMULATE_RANDOM_ERRORS_IN_SIGNAL && Math.random() < 0.3)
                s.r.b(new Error("Error in delay"));
            else {
                s.r(v);
                s.r.b(true);
            }
        }, ms);
        return s;
    }
    function sig(persistent) {
        var subs = [], endCond, isProcessing = false, lastValue;
        var s = Object.create(tdProto);
        ((s.c = s).r = function (val) {
            DEBUG_SIGNALS && log('signalled', val, 'subs:', subs.length);
            if (CHECK_CYCLES) {
                assert(!isProcessing, 'Cyclic signal');
                isProcessing = true;
            }
            lastValue = val;
            subs = subs.filter(function (lease) { return !lease(val) || (lease.b && lease.b(true), false); });
            if (CHECK_CYCLES) {
                isProcessing = false;
            }
            return !subs.length && !s.to;
        }).b = function (e) {
            DEBUG_SIGNALS && log('end signal, subs:', subs.length);
            MISUSE_CHECK && assert(e, 'End condition must be a truthy value');
            endCond = e;
            subs = subs.filter(function (lease) { return (lease.b && lease.b(endCond), false); });
        };
        s.to = function (reducer) {
            DEBUG && log('registered sub, lastValue =', lastValue);
            if (!endCond) {
                if (lastValue == void 0 || !reducer(lastValue)) {
                    subs.push(reducer);
                }
            }
            else {
                reducer.b && reducer.b(endCond);
            }
        };
        s.cur = function () { return lastValue; };
        s.t = sig; // Mark as signal
        return s;
    }
    function done(ev) {
        return function (reducer) {
            // TODO: We may need inherit here if more properties are added to Reducer
            return inherit({
                b: function (endcond) {
                    var v = reducer.b(endcond);
                    DEBUG && log('.b on done:', v);
                    ev(v);
                    ev.b && ev.b(true);
                    return v;
                }
            }, function (input) { return reducer(input); });
        };
    }
    function err(ev) {
        return function (reducer) {
            // TODO: We may need inherit here if more properties are added to Reducer
            return inherit({
                b: function (endcond) {
                    if (endcond !== true) {
                        ev(endcond);
                    }
                    return reducer.b && reducer.b(true);
                }
            }, function (input) { return reducer(input); });
        };
    }
    function around(f) {
        return function (reducer) {
            return inherit(reducer, function (input) { return f(function () { return reducer(input); }); });
        };
    }
    // Time-based xforms
    function sample(interval) {
        return function (reducer) {
            var latest, s = every(interval);
            s.to(function () { return reducer(latest); });
            return inherit(reducer, function (input) {
                latest = input;
            });
        };
    }
    function delay(d) {
        return function (reducer) {
            return inherit(reducer, function (input) {
                after(d).to(function () { return reducer(input); });
            });
        };
    }
    var Timer = typeof performance !== 'undefined' && performance.now ? performance : Date;
    function timegaps() {
        return function (reducer) {
            var last = Timer.now();
            return inherit(reducer, function (input) {
                var now = Timer.now(), gap = now - last;
                last = now;
                return reducer({ v: input, gap: gap });
            });
        };
    }
    function timestamp() {
        return function (reducer) {
            return inherit(reducer, function (input) {
                return reducer({ v: input, t: Timer.now() });
            });
        };
    }
    function add(x, y) {
        return x + y;
    }
    var deref = function () { return map(function (x) { return x.v; }); };
    var tdProto = {
        map: map,
        filter: filter,
        take: take,
        takeWhile: takeWhile,
        drop: drop,
        dropWhile: dropWhile,
        cat: cat,
        match: match,
        err: err,
        done: done,
        reducep: reducep,
        around: around,
        groupBy: groupBy,
        some: some,
        first: first,
        sample: sample,
        delay: delay,
        timegaps: timegaps,
        timestamp: timestamp,
        comp: function (td) { return td.f; },
    };
    var joinProto = {
        latest: latest,
        ordered: ordered,
        comp: function (td) { return td.f; },
    };
    var mod = function (coll) {
        var x = Object.create(tdProto);
        x.c = coll;
        return x;
    };
    // Signals
    mod.every = every;
    mod.after = after;
    mod.sig = sig;
    mod.range = range;
    function reg(proto, funcs) {
        objBind(funcs, function (v) {
            var k = v[0];
            var innerF = proto[k];
            mod[k] = proto[k] = function () {
                var t = innerF.apply(0, arguments), x = Object.create(proto), f = this.f;
                x.f = f ? function (r) {
                    // TODO: If we have a more efficient implementation of
                    // f, f -> t or f -> t -> r, we should use that. That may
                    // be the case if we know this.c is a special type such
                    // as a remote collection.
                    return f(t(r));
                } : t;
                x.c = this.c;
                return x;
            };
        });
    }
    reg(tdProto, tdProto);
    reg(joinProto, joinProto);
    tdProto.to = function (dest) {
        var r = this.f(Array.isArray(dest) ? arrayReducer(dest) : dest);
        if (this.c) {
            r = wait(r);
            // TODO: Add back join support when we have any useful joins for .to
            //if (join) r = join.f(r);
            feed(this.c, r());
            return r.b && r.b(true);
        }
        else {
            return r;
        }
    };
    tdProto.sig = function () {
        var s = sig();
        this.to(s.r);
        return s;
    };
    tdProto.toObj = function (dest) {
        return this.to(objReducer(dest));
    };
    tdProto.fold = fold;
    tdProto.mapcat = function (f, join) {
        return this.map(f).cat(join);
    };
    tdProto.sum = function () {
        return this.fold(add, 0);
    };
    tdProto.lazy = function () {
        var iter = unspool(this.c);
        if (!this.f)
            return iter;
        var buf = [], i = 0, r = this.f(arrayReducer(buf));
        // TODO: Using inherit here might be wrong if it will transfer other properties than .b
        // TODO: Normal users of iterators won't know to call .b. We must expect it not to be called.
        var u = inherit(r, {
            next: function () {
                while (i === buf.length) {
                    buf.length = i = 0;
                    var val = iter.next();
                    if (val.done) {
                        return { done: true };
                    }
                    r(val.value);
                }
                return { value: buf[i++] };
            }
        });
        u[protocolIterator] = function () { return u; };
        return u;
    };
    return mod;
});
