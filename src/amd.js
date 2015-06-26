(function () {
    /** @const */
    var DEBUG = false;
    /** @const */
    var MISUSE_CHECK = DEBUG || false;
    /** @const */
    var SIMULATE_TIMEOUT = false;
    /** @const */
    var SIMULATE_RANDOM_404 = false;
    /** @const */
    var DefaultTimeout = 7;
    // tsc still outputs lots of crap for enums so we'll have to make do with this.
    /** @const */
    var TimeOut = 0;
    /** @const */
    var LoadError = 1;
    var isNode = typeof window == 'undefined';
    var g = isNode ? exports : window;
    (g.require = function (deps, def, rootModule) {
        if (isNode && !def)
            return require(deps);
        define(deps, def);
        // There may be defines that haven't been processed here because they were
        // made outside a 'require' context. Those will automatically tag along into
        // this new context.
        rootModule = { b: 1, c: [] };
        rootModule.e = rootModule;
        setTimeout(function () {
            if (rootModule.c) {
                // Time-out
                err(TimeOut);
            }
        }, (opt.waitSeconds || DefaultTimeout) * 1000);
        flushDefines(rootModule);
    }).config = function (o) {
        opt = o;
        err = o.error || (function (e, name) {
            throw errstr(e, name);
        });
    };
    function errstr(e, name) {
        return ["Timeout loading module", "Error loading module: "][e] + (name || '');
    }
    var modules = { require: { a: g.require } }, defPromise = { c: [] }, requested = {}, opt, err;
    function then(m, f) {
        !m.c ? f(m.a) : m.c.push(f);
        return m;
    }
    function resolve(m, mobj) {
        if (m.c) {
            if (mobj)
                m.a = mobj;
            m.c.map(function (cb) { return cb(mobj); }); // .map is not ideal here, but we lose at least 7 bytes switching to something else!
            m.c = null;
        }
    }
    function flushDefines(ctx) {
        DEBUG && console.log('Flushing defines');
        resolve(defPromise, ctx);
        defPromise = { c: [] };
    }
    function getPath(name) {
        return (opt.baseUrl || '') + (opt.paths[name] || name) + '.js';
    }
    function getModule(name) {
        return modules[name] || (modules[name] = { a: {}, b: 1, c: [] });
    }
    function requestLoad(name, mod, ctx, m, path, node) {
        var existing = modules[name];
        m = getModule(name);
        DEBUG && console.log('Looking for ' + name + ', found ' + m);
        if (!existing && !requested[path = getPath(name)]) {
            requested[path] = true;
            DEBUG && console.log('Requesting ' + path);
            if (SIMULATE_RANDOM_404 && Math.random() < 0.3) {
                path += '_spam';
            }
            if (isNode) {
                var fullPath = __dirname + '/' + path;
                require('fs').readFile(fullPath, function (err, code) {
                    console.log('path:', fullPath);
                    require('vm').runInThisContext(code, { filename: 'fullPath' });
                    ctx.e = m;
                    flushDefines(ctx);
                });
            }
            else {
                // type = 'text/javascript' is default
                (node = document.createElement('script')).async = true; // TODO: We don't need this in new browsers as it's default.
                node.onload = function () {
                    ctx.e = m;
                    flushDefines(ctx);
                };
                node.onerror = function () {
                    ctx.c = 0;
                    err(LoadError, name);
                };
                node.src = path;
                if (!SIMULATE_TIMEOUT) {
                    document.head.appendChild(node);
                }
                else if (Math.random() < 0.3) {
                    setTimeout(function () {
                        document.head.appendChild(node);
                    }, (opt.timeoutSec || DefaultTimeout) * 1000 * 2);
                }
            }
        }
        return m;
    }
    (define = function (name, deps, def, mod) {
        if (def) {
            mod = getModule(name);
        }
        else {
            def = deps;
            deps = name;
            name = null;
            if (!def) {
                def = deps;
                deps = [];
            }
        }
        DEBUG && console.log('Schedule define called ' + name);
        then(defPromise, function (ctx, depPromises) {
            if (!mod) {
                mod = ctx.e;
                ctx.e = null;
            }
            if (MISUSE_CHECK && !mod)
                throw 'Ambiguous anonymous module';
            // Set exports object so that we can import it
            modules.exports = { a: mod.a };
            depPromises = deps.map(function (depName) {
                ++mod.b;
                return then(requestLoad(depName, mod, ctx), dec);
            });
            function dec() {
                if (mod.c && !--mod.b) {
                    resolve(mod, def.apply(null, depPromises.map(function (p) { return p.a; })));
                }
            }
            dec();
        });
    }).amd = true;
})();
