// ==========================================================================
// Project:  SproutCore Metal
// Copyright: ©2011 Strobe Inc. and contributors.
// License:   Licensed under MIT license (see license.js)
// ==========================================================================
/*globals sc_assert */

require('sproutcore-metal/core');
require('sproutcore-metal/platform');
require('sproutcore-metal/utils');

var USE_ACCESSORS = SC.platform.hasPropertyAccessors && SC.ENV.USE_ACCESSORS;
var TUPLE_RET = [];
var IS_GLOBAL = /^([A-Z$]|([0-9][A-Z$])).*[\.\*]/;
var IS_GLOBAL_SET = /^([A-Z$]|([0-9][A-Z$])).*[\.\*]?/;
var HAS_THIS  = /^this[\.\*]/;
var FIRST_KEY = /^([^\.\*]+)/;

var get;
var meta = SC.meta;
var o_get;
var o_set;
var set;


SC.USE_ACCESSORS = !!USE_ACCESSORS;


// ..........................................................
// GET AND SET
// 

// If we are on a platform that supports accessors we can get use those.
// Otherwise simulate accessors by looking up the property directly on the
// object.

/** @private */
get = function get(obj, keyName) {
  if (keyName === undefined && typeof obj === 'string') {
    keyName = obj;
    obj = SC;
  }

  if (!obj) { return undefined; }

  var ret = obj[keyName];
  if (ret === undefined && typeof obj.unknownProperty === 'function') {
    ret = obj.unknownProperty(keyName);
  }

  return ret;
};

/** @private */
set = function set(obj, keyName, value) {
  if (typeof obj === 'object' && !(keyName in obj)) {
    if (typeof obj.setUnknownProperty === 'function') {
      obj.setUnknownProperty(keyName, value);
    } else if (typeof obj.unknownProperty === 'function') {
      obj.unknownProperty(keyName, value);
    } else {
      obj[keyName] = value;
    }
  } else {
    obj[keyName] = value;
  }

  return value;
};

if (!USE_ACCESSORS) {
  o_get = get;
  o_set = set;

  /** @private */
  get = function(obj, keyName) {
    if (keyName === undefined && typeof obj === 'string') {
      keyName = obj;
      obj = SC;
    }

    if (!obj) { return undefined; }

    var desc = meta(obj, false).descs[keyName];
    if (desc) { return desc.get(obj, keyName); }
    else { return o_get(obj, keyName); }
  };

  /** @private */
  set = function(obj, keyName, value) {
    var desc = meta(obj, false).descs[keyName];
    if (desc) { desc.set(obj, keyName, value); }
    else { o_set(obj, keyName, value); }
    return value;
  };
}

/**
  Gets the value of a property on an object. If the property is computed,
  the function will be invoked. If the property is not defined and the
  object implements the unknownProperty() method, then that will be invoked.

  If you plan to run on IE8 and older browsers then you should use this
  method anytime you want to retrieve a property on an object that you don't
  know for sure is private. (By convention only properties beginning with
  an underscore '_' are considered private.)

  On all newer browsers, you only need to use this method to retrieve
  properties if the property might not be defined on the object and you want
  to respect the unknownProperty() handler. Otherwise you can ignore this
  method.

  Note that if the obj itself is null, this method will simply return
  undefined.

  @function

  @param {Object} obj
    The object to retrieve from.

  @param {String} keyName
    The property key to retrieve

  @returns {Object} the property value or null.
*/
SC.get = get;

/**
  Sets the value of a property on an object, respecting computed properties
  and notifying observers and other listeners of the change. If the
  property is not defined but the object implements the unknownProperty()
  method then that will be invoked as well.

  If you plan to run on IE8 and older browsers then you should use this
  method anytime you want to set a property on an object that you don't
  know for sure is private. (By convention only properties beginning with
  an underscore '_' are considered private.)

  On all newer browsers, you only need to use this method to set
  properties if the property might not be defined on the object and you want
  to respect the unknownProperty() handler. Otherwise you can ignore this
  method.

  @function

  @param {Object} obj
    The object to modify.

  @param {String} keyName
    The property key to set

  @param {Object} value
    The value to set

  @returns {Object} the passed value.
*/
SC.set = set;


// ..........................................................
// PATHS
// 

/** @private */
function normalizePath(path) {
  sc_assert('must pass non-empty string to normalizePath()',
    path && path !== '');

  if (path === '*') { return path; }
  var first = path[0];
  if (first === '.') { return 'this' + path; }
  if (first === '*' && path[1] !== '.') { return 'this.' + path.slice(1); }
  return path;
}

/** @private */
function firstKey(path) {
  return path.match(FIRST_KEY)[0];
}

/**
  @private

  Assumes normalized input; no *, normalized path, always a target...
*/
function getPath(target, path) {
  var len = path.length, idx, next, key;

  idx = path.indexOf('*');
  if (idx > 0 && path[idx - 1] !== '.') {
    return getPath(getPath(target, path.slice(0, idx)), path.slice(idx + 1));
  }

  idx = 0;
  while(target && idx < len) {
    next = path.indexOf('.', idx);
    if (next < 0) { next = len; }
    key = path.slice(idx, next);
    target = key === '*' ? target : get(target, key);
    idx = next + 1;
  }

  return target;
}

/**
  @private

  Assumes path is already normalized
*/
function normalizeTuple(target, path) {
  var hasThis = HAS_THIS.test(path),
      isGlobal = !hasThis && IS_GLOBAL.test(path),
      key, idx;

  if (!target || isGlobal) { target = window; }
  if (hasThis) { path = path.slice(5); }

  idx = path.indexOf('*');
  if (idx > 0 && path[idx - 1] !== '.') {
    // should not do lookup on a prototype object because the object isn't
    // really live yet.
    if (target && meta(target, false).proto !== target) {
      target = getPath(target, path.slice(0, idx));
    } else {
      target = null;
    }

    path = path.slice(idx+1);
  } else if (target === window) {
    key = firstKey(path);
    target = get(target, key);
    path = path.slice(key.length + 1);
  }

  // must return some kind of path to be valid else other things will break.
  if (!path || path.length === 0) { throw new Error('Invalid Path'); }

  TUPLE_RET[0] = target;
  TUPLE_RET[1] = path;
  return TUPLE_RET;
}

/**
  @private

  Normalizes a path to support older-style property paths beginning with . or *

  @function
  @param {String} path path to normalize
  @returns {String} normalized path
*/
SC.normalizePath = normalizePath;

/**
  @private

  Normalizes a target/path pair to reflect that actual target/path that should
  be observed, etc. This takes into account passing in global property
  paths (i.e. a path beginning with a captial letter not defined on the
  target) and * separators.

  @param {Object} target
    The current target. May be null.

  @param {String} path
    A path on the target or a global property path.

  @returns {Array} a temporary array with the normalized target/path pair.
*/
SC.normalizeTuple = function(target, path) {
  return normalizeTuple(target, normalizePath(path));
};

SC.normalizeTuple.primitive = normalizeTuple;

/**
  Looks up a property path on the passed object, using SC.get() as necessary.

  @param {Object} [root]
    The object to start the path from

  @param {String} path
    A path to evaluate

  @returns {Object} the value of the evaluated path, or null
*/
SC.getPath = function(root, path) {
  var hasThis, isGlobal;

  if (!path && typeof root === 'string') {
    path = root;
    root = null;
  }

  // detect complicated paths and normalize them
  path = normalizePath(path);
  hasThis = HAS_THIS.test(path);
  isGlobal = !hasThis && IS_GLOBAL.test(path);

  if (!root || hasThis || isGlobal || path.indexOf('*') > 0) {
    var tuple = normalizeTuple(root, path);
    root = tuple[0];
    path = tuple[1];
  } 

  return getPath(root, path);
};

/**
  Sets the value of the property at the end of the path, using
  SC.set() as necessary.

  @param {Object} [root]
    The object to start the path from

  @param {String} path
    A property path to evaluate

  @param {Object} value
    The value to set the property to

  @returns The value
*/
SC.setPath = function(root, path, value) {
  var keyName;

  if (arguments.length === 2 && typeof root === 'string') {
    value = path;
    path = root;
    root = null;
  }

  path = normalizePath(path);
  if (path.indexOf('*') > 0) {
    var tuple = normalizeTuple(root, path);
    root = tuple[0];
    path = tuple[1];
  }

  if (path.indexOf('.') > 0) {
    keyName = path.slice(path.lastIndexOf('.') + 1);
    path = path.slice(0, path.length - (keyName.length + 1));

    if (!HAS_THIS.test(path) && IS_GLOBAL_SET.test(path) && path.indexOf('.') < 0) {
      // special case only works during set...
      root = window[path];
    } else if (path !== 'this') {
      root = SC.getPath(root, path);
    }
  } else {
    if (IS_GLOBAL_SET.test(path)) { throw new Error('Invalid Path'); }
    keyName = path;
  }

  if (!keyName || keyName.length === 0 || keyName === '*') {
    throw new Error('Invalid Path');
  }

  return SC.set(root, keyName, value);
};
