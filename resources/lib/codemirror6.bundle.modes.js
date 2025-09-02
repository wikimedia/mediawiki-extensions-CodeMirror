'use strict';

var ext_CodeMirror_v6_lib = require('ext.CodeMirror.v6.lib');

/**
The default maximum length of a `TreeBuffer` node.
*/
const DefaultBufferLength = 1024;
let nextPropID = 0;
class Range {
    constructor(from, to) {
        this.from = from;
        this.to = to;
    }
}
/**
Each [node type](#common.NodeType) or [individual tree](#common.Tree)
can have metadata associated with it in props. Instances of this
class represent prop names.
*/
class NodeProp {
    /**
    Create a new node prop type.
    */
    constructor(config = {}) {
        this.id = nextPropID++;
        this.perNode = !!config.perNode;
        this.deserialize = config.deserialize || (() => {
            throw new Error("This node type doesn't define a deserialize function");
        });
    }
    /**
    This is meant to be used with
    [`NodeSet.extend`](#common.NodeSet.extend) or
    [`LRParser.configure`](#lr.ParserConfig.props) to compute
    prop values for each node type in the set. Takes a [match
    object](#common.NodeType^match) or function that returns undefined
    if the node type doesn't get this prop, and the prop's value if
    it does.
    */
    add(match) {
        if (this.perNode)
            throw new RangeError("Can't add per-node props to node types");
        if (typeof match != "function")
            match = NodeType.match(match);
        return (type) => {
            let result = match(type);
            return result === undefined ? null : [this, result];
        };
    }
}
/**
Prop that is used to describe matching delimiters. For opening
delimiters, this holds an array of node names (written as a
space-separated string when declaring this prop in a grammar)
for the node types of closing delimiters that match it.
*/
NodeProp.closedBy = new NodeProp({ deserialize: str => str.split(" ") });
/**
The inverse of [`closedBy`](#common.NodeProp^closedBy). This is
attached to closing delimiters, holding an array of node names
of types of matching opening delimiters.
*/
NodeProp.openedBy = new NodeProp({ deserialize: str => str.split(" ") });
/**
Used to assign node types to groups (for example, all node
types that represent an expression could be tagged with an
`"Expression"` group).
*/
NodeProp.group = new NodeProp({ deserialize: str => str.split(" ") });
/**
Attached to nodes to indicate these should be
[displayed](https://codemirror.net/docs/ref/#language.syntaxTree)
in a bidirectional text isolate, so that direction-neutral
characters on their sides don't incorrectly get associated with
surrounding text. You'll generally want to set this for nodes
that contain arbitrary text, like strings and comments, and for
nodes that appear _inside_ arbitrary text, like HTML tags. When
not given a value, in a grammar declaration, defaults to
`"auto"`.
*/
NodeProp.isolate = new NodeProp({ deserialize: value => {
        if (value && value != "rtl" && value != "ltr" && value != "auto")
            throw new RangeError("Invalid value for isolate: " + value);
        return value || "auto";
    } });
/**
The hash of the [context](#lr.ContextTracker.constructor)
that the node was parsed in, if any. Used to limit reuse of
contextual nodes.
*/
NodeProp.contextHash = new NodeProp({ perNode: true });
/**
The distance beyond the end of the node that the tokenizer
looked ahead for any of the tokens inside the node. (The LR
parser only stores this when it is larger than 25, for
efficiency reasons.)
*/
NodeProp.lookAhead = new NodeProp({ perNode: true });
/**
This per-node prop is used to replace a given node, or part of a
node, with another tree. This is useful to include trees from
different languages in mixed-language parsers.
*/
NodeProp.mounted = new NodeProp({ perNode: true });
/**
A mounted tree, which can be [stored](#common.NodeProp^mounted) on
a tree node to indicate that parts of its content are
represented by another tree.
*/
class MountedTree {
    constructor(
    /**
    The inner tree.
    */
    tree, 
    /**
    If this is null, this tree replaces the entire node (it will
    be included in the regular iteration instead of its host
    node). If not, only the given ranges are considered to be
    covered by this tree. This is used for trees that are mixed in
    a way that isn't strictly hierarchical. Such mounted trees are
    only entered by [`resolveInner`](#common.Tree.resolveInner)
    and [`enter`](#common.SyntaxNode.enter).
    */
    overlay, 
    /**
    The parser used to create this subtree.
    */
    parser) {
        this.tree = tree;
        this.overlay = overlay;
        this.parser = parser;
    }
    /**
    @internal
    */
    static get(tree) {
        return tree && tree.props && tree.props[NodeProp.mounted.id];
    }
}
const noProps = Object.create(null);
/**
Each node in a syntax tree has a node type associated with it.
*/
class NodeType {
    /**
    @internal
    */
    constructor(
    /**
    The name of the node type. Not necessarily unique, but if the
    grammar was written properly, different node types with the
    same name within a node set should play the same semantic
    role.
    */
    name, 
    /**
    @internal
    */
    props, 
    /**
    The id of this node in its set. Corresponds to the term ids
    used in the parser.
    */
    id, 
    /**
    @internal
    */
    flags = 0) {
        this.name = name;
        this.props = props;
        this.id = id;
        this.flags = flags;
    }
    /**
    Define a node type.
    */
    static define(spec) {
        let props = spec.props && spec.props.length ? Object.create(null) : noProps;
        let flags = (spec.top ? 1 /* NodeFlag.Top */ : 0) | (spec.skipped ? 2 /* NodeFlag.Skipped */ : 0) |
            (spec.error ? 4 /* NodeFlag.Error */ : 0) | (spec.name == null ? 8 /* NodeFlag.Anonymous */ : 0);
        let type = new NodeType(spec.name || "", props, spec.id, flags);
        if (spec.props)
            for (let src of spec.props) {
                if (!Array.isArray(src))
                    src = src(type);
                if (src) {
                    if (src[0].perNode)
                        throw new RangeError("Can't store a per-node prop on a node type");
                    props[src[0].id] = src[1];
                }
            }
        return type;
    }
    /**
    Retrieves a node prop for this type. Will return `undefined` if
    the prop isn't present on this node.
    */
    prop(prop) { return this.props[prop.id]; }
    /**
    True when this is the top node of a grammar.
    */
    get isTop() { return (this.flags & 1 /* NodeFlag.Top */) > 0; }
    /**
    True when this node is produced by a skip rule.
    */
    get isSkipped() { return (this.flags & 2 /* NodeFlag.Skipped */) > 0; }
    /**
    Indicates whether this is an error node.
    */
    get isError() { return (this.flags & 4 /* NodeFlag.Error */) > 0; }
    /**
    When true, this node type doesn't correspond to a user-declared
    named node, for example because it is used to cache repetition.
    */
    get isAnonymous() { return (this.flags & 8 /* NodeFlag.Anonymous */) > 0; }
    /**
    Returns true when this node's name or one of its
    [groups](#common.NodeProp^group) matches the given string.
    */
    is(name) {
        if (typeof name == 'string') {
            if (this.name == name)
                return true;
            let group = this.prop(NodeProp.group);
            return group ? group.indexOf(name) > -1 : false;
        }
        return this.id == name;
    }
    /**
    Create a function from node types to arbitrary values by
    specifying an object whose property names are node or
    [group](#common.NodeProp^group) names. Often useful with
    [`NodeProp.add`](#common.NodeProp.add). You can put multiple
    names, separated by spaces, in a single property name to map
    multiple node names to a single value.
    */
    static match(map) {
        let direct = Object.create(null);
        for (let prop in map)
            for (let name of prop.split(" "))
                direct[name] = map[prop];
        return (node) => {
            for (let groups = node.prop(NodeProp.group), i = -1; i < (groups ? groups.length : 0); i++) {
                let found = direct[i < 0 ? node.name : groups[i]];
                if (found)
                    return found;
            }
        };
    }
}
/**
An empty dummy node type to use when no actual type is available.
*/
NodeType.none = new NodeType("", Object.create(null), 0, 8 /* NodeFlag.Anonymous */);
/**
A node set holds a collection of node types. It is used to
compactly represent trees by storing their type ids, rather than a
full pointer to the type object, in a numeric array. Each parser
[has](#lr.LRParser.nodeSet) a node set, and [tree
buffers](#common.TreeBuffer) can only store collections of nodes
from the same set. A set can have a maximum of 2**16 (65536) node
types in it, so that the ids fit into 16-bit typed array slots.
*/
class NodeSet {
    /**
    Create a set with the given types. The `id` property of each
    type should correspond to its position within the array.
    */
    constructor(
    /**
    The node types in this set, by id.
    */
    types) {
        this.types = types;
        for (let i = 0; i < types.length; i++)
            if (types[i].id != i)
                throw new RangeError("Node type ids should correspond to array positions when creating a node set");
    }
    /**
    Create a copy of this set with some node properties added. The
    arguments to this method can be created with
    [`NodeProp.add`](#common.NodeProp.add).
    */
    extend(...props) {
        let newTypes = [];
        for (let type of this.types) {
            let newProps = null;
            for (let source of props) {
                let add = source(type);
                if (add) {
                    if (!newProps)
                        newProps = Object.assign({}, type.props);
                    newProps[add[0].id] = add[1];
                }
            }
            newTypes.push(newProps ? new NodeType(type.name, newProps, type.id, type.flags) : type);
        }
        return new NodeSet(newTypes);
    }
}
const CachedNode = new WeakMap(), CachedInnerNode = new WeakMap();
/**
Options that control iteration. Can be combined with the `|`
operator to enable multiple ones.
*/
exports.IterMode = void 0;
(function (IterMode) {
    /**
    When enabled, iteration will only visit [`Tree`](#common.Tree)
    objects, not nodes packed into
    [`TreeBuffer`](#common.TreeBuffer)s.
    */
    IterMode[IterMode["ExcludeBuffers"] = 1] = "ExcludeBuffers";
    /**
    Enable this to make iteration include anonymous nodes (such as
    the nodes that wrap repeated grammar constructs into a balanced
    tree).
    */
    IterMode[IterMode["IncludeAnonymous"] = 2] = "IncludeAnonymous";
    /**
    By default, regular [mounted](#common.NodeProp^mounted) nodes
    replace their base node in iteration. Enable this to ignore them
    instead.
    */
    IterMode[IterMode["IgnoreMounts"] = 4] = "IgnoreMounts";
    /**
    This option only applies in
    [`enter`](#common.SyntaxNode.enter)-style methods. It tells the
    library to not enter mounted overlays if one covers the given
    position.
    */
    IterMode[IterMode["IgnoreOverlays"] = 8] = "IgnoreOverlays";
})(exports.IterMode || (exports.IterMode = {}));
/**
A piece of syntax tree. There are two ways to approach these
trees: the way they are actually stored in memory, and the
convenient way.

Syntax trees are stored as a tree of `Tree` and `TreeBuffer`
objects. By packing detail information into `TreeBuffer` leaf
nodes, the representation is made a lot more memory-efficient.

However, when you want to actually work with tree nodes, this
representation is very awkward, so most client code will want to
use the [`TreeCursor`](#common.TreeCursor) or
[`SyntaxNode`](#common.SyntaxNode) interface instead, which provides
a view on some part of this data structure, and can be used to
move around to adjacent nodes.
*/
class Tree {
    /**
    Construct a new tree. See also [`Tree.build`](#common.Tree^build).
    */
    constructor(
    /**
    The type of the top node.
    */
    type, 
    /**
    This node's child nodes.
    */
    children, 
    /**
    The positions (offsets relative to the start of this tree) of
    the children.
    */
    positions, 
    /**
    The total length of this tree
    */
    length, 
    /**
    Per-node [node props](#common.NodeProp) to associate with this node.
    */
    props) {
        this.type = type;
        this.children = children;
        this.positions = positions;
        this.length = length;
        /**
        @internal
        */
        this.props = null;
        if (props && props.length) {
            this.props = Object.create(null);
            for (let [prop, value] of props)
                this.props[typeof prop == "number" ? prop : prop.id] = value;
        }
    }
    /**
    @internal
    */
    toString() {
        let mounted = MountedTree.get(this);
        if (mounted && !mounted.overlay)
            return mounted.tree.toString();
        let children = "";
        for (let ch of this.children) {
            let str = ch.toString();
            if (str) {
                if (children)
                    children += ",";
                children += str;
            }
        }
        return !this.type.name ? children :
            (/\W/.test(this.type.name) && !this.type.isError ? JSON.stringify(this.type.name) : this.type.name) +
                (children.length ? "(" + children + ")" : "");
    }
    /**
    Get a [tree cursor](#common.TreeCursor) positioned at the top of
    the tree. Mode can be used to [control](#common.IterMode) which
    nodes the cursor visits.
    */
    cursor(mode = 0) {
        return new TreeCursor(this.topNode, mode);
    }
    /**
    Get a [tree cursor](#common.TreeCursor) pointing into this tree
    at the given position and side (see
    [`moveTo`](#common.TreeCursor.moveTo).
    */
    cursorAt(pos, side = 0, mode = 0) {
        let scope = CachedNode.get(this) || this.topNode;
        let cursor = new TreeCursor(scope);
        cursor.moveTo(pos, side);
        CachedNode.set(this, cursor._tree);
        return cursor;
    }
    /**
    Get a [syntax node](#common.SyntaxNode) object for the top of the
    tree.
    */
    get topNode() {
        return new TreeNode(this, 0, 0, null);
    }
    /**
    Get the [syntax node](#common.SyntaxNode) at the given position.
    If `side` is -1, this will move into nodes that end at the
    position. If 1, it'll move into nodes that start at the
    position. With 0, it'll only enter nodes that cover the position
    from both sides.
    
    Note that this will not enter
    [overlays](#common.MountedTree.overlay), and you often want
    [`resolveInner`](#common.Tree.resolveInner) instead.
    */
    resolve(pos, side = 0) {
        let node = resolveNode(CachedNode.get(this) || this.topNode, pos, side, false);
        CachedNode.set(this, node);
        return node;
    }
    /**
    Like [`resolve`](#common.Tree.resolve), but will enter
    [overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
    pointing into the innermost overlaid tree at the given position
    (with parent links going through all parent structure, including
    the host trees).
    */
    resolveInner(pos, side = 0) {
        let node = resolveNode(CachedInnerNode.get(this) || this.topNode, pos, side, true);
        CachedInnerNode.set(this, node);
        return node;
    }
    /**
    In some situations, it can be useful to iterate through all
    nodes around a position, including those in overlays that don't
    directly cover the position. This method gives you an iterator
    that will produce all nodes, from small to big, around the given
    position.
    */
    resolveStack(pos, side = 0) {
        return stackIterator(this, pos, side);
    }
    /**
    Iterate over the tree and its children, calling `enter` for any
    node that touches the `from`/`to` region (if given) before
    running over such a node's children, and `leave` (if given) when
    leaving the node. When `enter` returns `false`, that node will
    not have its children iterated over (or `leave` called).
    */
    iterate(spec) {
        let { enter, leave, from = 0, to = this.length } = spec;
        let mode = spec.mode || 0, anon = (mode & exports.IterMode.IncludeAnonymous) > 0;
        for (let c = this.cursor(mode | exports.IterMode.IncludeAnonymous);;) {
            let entered = false;
            if (c.from <= to && c.to >= from && (!anon && c.type.isAnonymous || enter(c) !== false)) {
                if (c.firstChild())
                    continue;
                entered = true;
            }
            for (;;) {
                if (entered && leave && (anon || !c.type.isAnonymous))
                    leave(c);
                if (c.nextSibling())
                    break;
                if (!c.parent())
                    return;
                entered = true;
            }
        }
    }
    /**
    Get the value of the given [node prop](#common.NodeProp) for this
    node. Works with both per-node and per-type props.
    */
    prop(prop) {
        return !prop.perNode ? this.type.prop(prop) : this.props ? this.props[prop.id] : undefined;
    }
    /**
    Returns the node's [per-node props](#common.NodeProp.perNode) in a
    format that can be passed to the [`Tree`](#common.Tree)
    constructor.
    */
    get propValues() {
        let result = [];
        if (this.props)
            for (let id in this.props)
                result.push([+id, this.props[id]]);
        return result;
    }
    /**
    Balance the direct children of this tree, producing a copy of
    which may have children grouped into subtrees with type
    [`NodeType.none`](#common.NodeType^none).
    */
    balance(config = {}) {
        return this.children.length <= 8 /* Balance.BranchFactor */ ? this :
            balanceRange(NodeType.none, this.children, this.positions, 0, this.children.length, 0, this.length, (children, positions, length) => new Tree(this.type, children, positions, length, this.propValues), config.makeTree || ((children, positions, length) => new Tree(NodeType.none, children, positions, length)));
    }
    /**
    Build a tree from a postfix-ordered buffer of node information,
    or a cursor over such a buffer.
    */
    static build(data) { return buildTree(data); }
}
/**
The empty tree
*/
Tree.empty = new Tree(NodeType.none, [], [], 0);
class FlatBufferCursor {
    constructor(buffer, index) {
        this.buffer = buffer;
        this.index = index;
    }
    get id() { return this.buffer[this.index - 4]; }
    get start() { return this.buffer[this.index - 3]; }
    get end() { return this.buffer[this.index - 2]; }
    get size() { return this.buffer[this.index - 1]; }
    get pos() { return this.index; }
    next() { this.index -= 4; }
    fork() { return new FlatBufferCursor(this.buffer, this.index); }
}
/**
Tree buffers contain (type, start, end, endIndex) quads for each
node. In such a buffer, nodes are stored in prefix order (parents
before children, with the endIndex of the parent indicating which
children belong to it).
*/
class TreeBuffer {
    /**
    Create a tree buffer.
    */
    constructor(
    /**
    The buffer's content.
    */
    buffer, 
    /**
    The total length of the group of nodes in the buffer.
    */
    length, 
    /**
    The node set used in this buffer.
    */
    set) {
        this.buffer = buffer;
        this.length = length;
        this.set = set;
    }
    /**
    @internal
    */
    get type() { return NodeType.none; }
    /**
    @internal
    */
    toString() {
        let result = [];
        for (let index = 0; index < this.buffer.length;) {
            result.push(this.childString(index));
            index = this.buffer[index + 3];
        }
        return result.join(",");
    }
    /**
    @internal
    */
    childString(index) {
        let id = this.buffer[index], endIndex = this.buffer[index + 3];
        let type = this.set.types[id], result = type.name;
        if (/\W/.test(result) && !type.isError)
            result = JSON.stringify(result);
        index += 4;
        if (endIndex == index)
            return result;
        let children = [];
        while (index < endIndex) {
            children.push(this.childString(index));
            index = this.buffer[index + 3];
        }
        return result + "(" + children.join(",") + ")";
    }
    /**
    @internal
    */
    findChild(startIndex, endIndex, dir, pos, side) {
        let { buffer } = this, pick = -1;
        for (let i = startIndex; i != endIndex; i = buffer[i + 3]) {
            if (checkSide(side, pos, buffer[i + 1], buffer[i + 2])) {
                pick = i;
                if (dir > 0)
                    break;
            }
        }
        return pick;
    }
    /**
    @internal
    */
    slice(startI, endI, from) {
        let b = this.buffer;
        let copy = new Uint16Array(endI - startI), len = 0;
        for (let i = startI, j = 0; i < endI;) {
            copy[j++] = b[i++];
            copy[j++] = b[i++] - from;
            let to = copy[j++] = b[i++] - from;
            copy[j++] = b[i++] - startI;
            len = Math.max(len, to);
        }
        return new TreeBuffer(copy, len, this.set);
    }
}
function checkSide(side, pos, from, to) {
    switch (side) {
        case -2 /* Side.Before */: return from < pos;
        case -1 /* Side.AtOrBefore */: return to >= pos && from < pos;
        case 0 /* Side.Around */: return from < pos && to > pos;
        case 1 /* Side.AtOrAfter */: return from <= pos && to > pos;
        case 2 /* Side.After */: return to > pos;
        case 4 /* Side.DontCare */: return true;
    }
}
function resolveNode(node, pos, side, overlays) {
    var _a;
    // Move up to a node that actually holds the position, if possible
    while (node.from == node.to ||
        (side < 1 ? node.from >= pos : node.from > pos) ||
        (side > -1 ? node.to <= pos : node.to < pos)) {
        let parent = !overlays && node instanceof TreeNode && node.index < 0 ? null : node.parent;
        if (!parent)
            return node;
        node = parent;
    }
    let mode = overlays ? 0 : exports.IterMode.IgnoreOverlays;
    // Must go up out of overlays when those do not overlap with pos
    if (overlays)
        for (let scan = node, parent = scan.parent; parent; scan = parent, parent = scan.parent) {
            if (scan instanceof TreeNode && scan.index < 0 && ((_a = parent.enter(pos, side, mode)) === null || _a === void 0 ? void 0 : _a.from) != scan.from)
                node = parent;
        }
    for (;;) {
        let inner = node.enter(pos, side, mode);
        if (!inner)
            return node;
        node = inner;
    }
}
class BaseNode {
    cursor(mode = 0) { return new TreeCursor(this, mode); }
    getChild(type, before = null, after = null) {
        let r = getChildren(this, type, before, after);
        return r.length ? r[0] : null;
    }
    getChildren(type, before = null, after = null) {
        return getChildren(this, type, before, after);
    }
    resolve(pos, side = 0) {
        return resolveNode(this, pos, side, false);
    }
    resolveInner(pos, side = 0) {
        return resolveNode(this, pos, side, true);
    }
    matchContext(context) {
        return matchNodeContext(this.parent, context);
    }
    enterUnfinishedNodesBefore(pos) {
        let scan = this.childBefore(pos), node = this;
        while (scan) {
            let last = scan.lastChild;
            if (!last || last.to != scan.to)
                break;
            if (last.type.isError && last.from == last.to) {
                node = scan;
                scan = last.prevSibling;
            }
            else {
                scan = last;
            }
        }
        return node;
    }
    get node() { return this; }
    get next() { return this.parent; }
}
class TreeNode extends BaseNode {
    constructor(_tree, from, 
    // Index in parent node, set to -1 if the node is not a direct child of _parent.node (overlay)
    index, _parent) {
        super();
        this._tree = _tree;
        this.from = from;
        this.index = index;
        this._parent = _parent;
    }
    get type() { return this._tree.type; }
    get name() { return this._tree.type.name; }
    get to() { return this.from + this._tree.length; }
    nextChild(i, dir, pos, side, mode = 0) {
        for (let parent = this;;) {
            for (let { children, positions } = parent._tree, e = dir > 0 ? children.length : -1; i != e; i += dir) {
                let next = children[i], start = positions[i] + parent.from;
                if (!checkSide(side, pos, start, start + next.length))
                    continue;
                if (next instanceof TreeBuffer) {
                    if (mode & exports.IterMode.ExcludeBuffers)
                        continue;
                    let index = next.findChild(0, next.buffer.length, dir, pos - start, side);
                    if (index > -1)
                        return new BufferNode(new BufferContext(parent, next, i, start), null, index);
                }
                else if ((mode & exports.IterMode.IncludeAnonymous) || (!next.type.isAnonymous || hasChild(next))) {
                    let mounted;
                    if (!(mode & exports.IterMode.IgnoreMounts) && (mounted = MountedTree.get(next)) && !mounted.overlay)
                        return new TreeNode(mounted.tree, start, i, parent);
                    let inner = new TreeNode(next, start, i, parent);
                    return (mode & exports.IterMode.IncludeAnonymous) || !inner.type.isAnonymous ? inner
                        : inner.nextChild(dir < 0 ? next.children.length - 1 : 0, dir, pos, side);
                }
            }
            if ((mode & exports.IterMode.IncludeAnonymous) || !parent.type.isAnonymous)
                return null;
            if (parent.index >= 0)
                i = parent.index + dir;
            else
                i = dir < 0 ? -1 : parent._parent._tree.children.length;
            parent = parent._parent;
            if (!parent)
                return null;
        }
    }
    get firstChild() { return this.nextChild(0, 1, 0, 4 /* Side.DontCare */); }
    get lastChild() { return this.nextChild(this._tree.children.length - 1, -1, 0, 4 /* Side.DontCare */); }
    childAfter(pos) { return this.nextChild(0, 1, pos, 2 /* Side.After */); }
    childBefore(pos) { return this.nextChild(this._tree.children.length - 1, -1, pos, -2 /* Side.Before */); }
    enter(pos, side, mode = 0) {
        let mounted;
        if (!(mode & exports.IterMode.IgnoreOverlays) && (mounted = MountedTree.get(this._tree)) && mounted.overlay) {
            let rPos = pos - this.from;
            for (let { from, to } of mounted.overlay) {
                if ((side > 0 ? from <= rPos : from < rPos) &&
                    (side < 0 ? to >= rPos : to > rPos))
                    return new TreeNode(mounted.tree, mounted.overlay[0].from + this.from, -1, this);
            }
        }
        return this.nextChild(0, 1, pos, side, mode);
    }
    nextSignificantParent() {
        let val = this;
        while (val.type.isAnonymous && val._parent)
            val = val._parent;
        return val;
    }
    get parent() {
        return this._parent ? this._parent.nextSignificantParent() : null;
    }
    get nextSibling() {
        return this._parent && this.index >= 0 ? this._parent.nextChild(this.index + 1, 1, 0, 4 /* Side.DontCare */) : null;
    }
    get prevSibling() {
        return this._parent && this.index >= 0 ? this._parent.nextChild(this.index - 1, -1, 0, 4 /* Side.DontCare */) : null;
    }
    get tree() { return this._tree; }
    toTree() { return this._tree; }
    /**
    @internal
    */
    toString() { return this._tree.toString(); }
}
function getChildren(node, type, before, after) {
    let cur = node.cursor(), result = [];
    if (!cur.firstChild())
        return result;
    if (before != null)
        for (let found = false; !found;) {
            found = cur.type.is(before);
            if (!cur.nextSibling())
                return result;
        }
    for (;;) {
        if (after != null && cur.type.is(after))
            return result;
        if (cur.type.is(type))
            result.push(cur.node);
        if (!cur.nextSibling())
            return after == null ? result : [];
    }
}
function matchNodeContext(node, context, i = context.length - 1) {
    for (let p = node; i >= 0; p = p.parent) {
        if (!p)
            return false;
        if (!p.type.isAnonymous) {
            if (context[i] && context[i] != p.name)
                return false;
            i--;
        }
    }
    return true;
}
class BufferContext {
    constructor(parent, buffer, index, start) {
        this.parent = parent;
        this.buffer = buffer;
        this.index = index;
        this.start = start;
    }
}
class BufferNode extends BaseNode {
    get name() { return this.type.name; }
    get from() { return this.context.start + this.context.buffer.buffer[this.index + 1]; }
    get to() { return this.context.start + this.context.buffer.buffer[this.index + 2]; }
    constructor(context, _parent, index) {
        super();
        this.context = context;
        this._parent = _parent;
        this.index = index;
        this.type = context.buffer.set.types[context.buffer.buffer[index]];
    }
    child(dir, pos, side) {
        let { buffer } = this.context;
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.context.start, side);
        return index < 0 ? null : new BufferNode(this.context, this, index);
    }
    get firstChild() { return this.child(1, 0, 4 /* Side.DontCare */); }
    get lastChild() { return this.child(-1, 0, 4 /* Side.DontCare */); }
    childAfter(pos) { return this.child(1, pos, 2 /* Side.After */); }
    childBefore(pos) { return this.child(-1, pos, -2 /* Side.Before */); }
    enter(pos, side, mode = 0) {
        if (mode & exports.IterMode.ExcludeBuffers)
            return null;
        let { buffer } = this.context;
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], side > 0 ? 1 : -1, pos - this.context.start, side);
        return index < 0 ? null : new BufferNode(this.context, this, index);
    }
    get parent() {
        return this._parent || this.context.parent.nextSignificantParent();
    }
    externalSibling(dir) {
        return this._parent ? null : this.context.parent.nextChild(this.context.index + dir, dir, 0, 4 /* Side.DontCare */);
    }
    get nextSibling() {
        let { buffer } = this.context;
        let after = buffer.buffer[this.index + 3];
        if (after < (this._parent ? buffer.buffer[this._parent.index + 3] : buffer.buffer.length))
            return new BufferNode(this.context, this._parent, after);
        return this.externalSibling(1);
    }
    get prevSibling() {
        let { buffer } = this.context;
        let parentStart = this._parent ? this._parent.index + 4 : 0;
        if (this.index == parentStart)
            return this.externalSibling(-1);
        return new BufferNode(this.context, this._parent, buffer.findChild(parentStart, this.index, -1, 0, 4 /* Side.DontCare */));
    }
    get tree() { return null; }
    toTree() {
        let children = [], positions = [];
        let { buffer } = this.context;
        let startI = this.index + 4, endI = buffer.buffer[this.index + 3];
        if (endI > startI) {
            let from = buffer.buffer[this.index + 1];
            children.push(buffer.slice(startI, endI, from));
            positions.push(0);
        }
        return new Tree(this.type, children, positions, this.to - this.from);
    }
    /**
    @internal
    */
    toString() { return this.context.buffer.childString(this.index); }
}
function iterStack(heads) {
    if (!heads.length)
        return null;
    let pick = 0, picked = heads[0];
    for (let i = 1; i < heads.length; i++) {
        let node = heads[i];
        if (node.from > picked.from || node.to < picked.to) {
            picked = node;
            pick = i;
        }
    }
    let next = picked instanceof TreeNode && picked.index < 0 ? null : picked.parent;
    let newHeads = heads.slice();
    if (next)
        newHeads[pick] = next;
    else
        newHeads.splice(pick, 1);
    return new StackIterator(newHeads, picked);
}
class StackIterator {
    constructor(heads, node) {
        this.heads = heads;
        this.node = node;
    }
    get next() { return iterStack(this.heads); }
}
function stackIterator(tree, pos, side) {
    let inner = tree.resolveInner(pos, side), layers = null;
    for (let scan = inner instanceof TreeNode ? inner : inner.context.parent; scan; scan = scan.parent) {
        if (scan.index < 0) { // This is an overlay root
            let parent = scan.parent;
            (layers || (layers = [inner])).push(parent.resolve(pos, side));
            scan = parent;
        }
        else {
            let mount = MountedTree.get(scan.tree);
            // Relevant overlay branching off
            if (mount && mount.overlay && mount.overlay[0].from <= pos && mount.overlay[mount.overlay.length - 1].to >= pos) {
                let root = new TreeNode(mount.tree, mount.overlay[0].from + scan.from, -1, scan);
                (layers || (layers = [inner])).push(resolveNode(root, pos, side, false));
            }
        }
    }
    return layers ? iterStack(layers) : inner;
}
/**
A tree cursor object focuses on a given node in a syntax tree, and
allows you to move to adjacent nodes.
*/
class TreeCursor {
    /**
    Shorthand for `.type.name`.
    */
    get name() { return this.type.name; }
    /**
    @internal
    */
    constructor(node, 
    /**
    @internal
    */
    mode = 0) {
        this.mode = mode;
        /**
        @internal
        */
        this.buffer = null;
        this.stack = [];
        /**
        @internal
        */
        this.index = 0;
        this.bufferNode = null;
        if (node instanceof TreeNode) {
            this.yieldNode(node);
        }
        else {
            this._tree = node.context.parent;
            this.buffer = node.context;
            for (let n = node._parent; n; n = n._parent)
                this.stack.unshift(n.index);
            this.bufferNode = node;
            this.yieldBuf(node.index);
        }
    }
    yieldNode(node) {
        if (!node)
            return false;
        this._tree = node;
        this.type = node.type;
        this.from = node.from;
        this.to = node.to;
        return true;
    }
    yieldBuf(index, type) {
        this.index = index;
        let { start, buffer } = this.buffer;
        this.type = type || buffer.set.types[buffer.buffer[index]];
        this.from = start + buffer.buffer[index + 1];
        this.to = start + buffer.buffer[index + 2];
        return true;
    }
    /**
    @internal
    */
    yield(node) {
        if (!node)
            return false;
        if (node instanceof TreeNode) {
            this.buffer = null;
            return this.yieldNode(node);
        }
        this.buffer = node.context;
        return this.yieldBuf(node.index, node.type);
    }
    /**
    @internal
    */
    toString() {
        return this.buffer ? this.buffer.buffer.childString(this.index) : this._tree.toString();
    }
    /**
    @internal
    */
    enterChild(dir, pos, side) {
        if (!this.buffer)
            return this.yield(this._tree.nextChild(dir < 0 ? this._tree._tree.children.length - 1 : 0, dir, pos, side, this.mode));
        let { buffer } = this.buffer;
        let index = buffer.findChild(this.index + 4, buffer.buffer[this.index + 3], dir, pos - this.buffer.start, side);
        if (index < 0)
            return false;
        this.stack.push(this.index);
        return this.yieldBuf(index);
    }
    /**
    Move the cursor to this node's first child. When this returns
    false, the node has no child, and the cursor has not been moved.
    */
    firstChild() { return this.enterChild(1, 0, 4 /* Side.DontCare */); }
    /**
    Move the cursor to this node's last child.
    */
    lastChild() { return this.enterChild(-1, 0, 4 /* Side.DontCare */); }
    /**
    Move the cursor to the first child that ends after `pos`.
    */
    childAfter(pos) { return this.enterChild(1, pos, 2 /* Side.After */); }
    /**
    Move to the last child that starts before `pos`.
    */
    childBefore(pos) { return this.enterChild(-1, pos, -2 /* Side.Before */); }
    /**
    Move the cursor to the child around `pos`. If side is -1 the
    child may end at that position, when 1 it may start there. This
    will also enter [overlaid](#common.MountedTree.overlay)
    [mounted](#common.NodeProp^mounted) trees unless `overlays` is
    set to false.
    */
    enter(pos, side, mode = this.mode) {
        if (!this.buffer)
            return this.yield(this._tree.enter(pos, side, mode));
        return mode & exports.IterMode.ExcludeBuffers ? false : this.enterChild(1, pos, side);
    }
    /**
    Move to the node's parent node, if this isn't the top node.
    */
    parent() {
        if (!this.buffer)
            return this.yieldNode((this.mode & exports.IterMode.IncludeAnonymous) ? this._tree._parent : this._tree.parent);
        if (this.stack.length)
            return this.yieldBuf(this.stack.pop());
        let parent = (this.mode & exports.IterMode.IncludeAnonymous) ? this.buffer.parent : this.buffer.parent.nextSignificantParent();
        this.buffer = null;
        return this.yieldNode(parent);
    }
    /**
    @internal
    */
    sibling(dir) {
        if (!this.buffer)
            return !this._tree._parent ? false
                : this.yield(this._tree.index < 0 ? null
                    : this._tree._parent.nextChild(this._tree.index + dir, dir, 0, 4 /* Side.DontCare */, this.mode));
        let { buffer } = this.buffer, d = this.stack.length - 1;
        if (dir < 0) {
            let parentStart = d < 0 ? 0 : this.stack[d] + 4;
            if (this.index != parentStart)
                return this.yieldBuf(buffer.findChild(parentStart, this.index, -1, 0, 4 /* Side.DontCare */));
        }
        else {
            let after = buffer.buffer[this.index + 3];
            if (after < (d < 0 ? buffer.buffer.length : buffer.buffer[this.stack[d] + 3]))
                return this.yieldBuf(after);
        }
        return d < 0 ? this.yield(this.buffer.parent.nextChild(this.buffer.index + dir, dir, 0, 4 /* Side.DontCare */, this.mode)) : false;
    }
    /**
    Move to this node's next sibling, if any.
    */
    nextSibling() { return this.sibling(1); }
    /**
    Move to this node's previous sibling, if any.
    */
    prevSibling() { return this.sibling(-1); }
    atLastNode(dir) {
        let index, parent, { buffer } = this;
        if (buffer) {
            if (dir > 0) {
                if (this.index < buffer.buffer.buffer.length)
                    return false;
            }
            else {
                for (let i = 0; i < this.index; i++)
                    if (buffer.buffer.buffer[i + 3] < this.index)
                        return false;
            }
            ({ index, parent } = buffer);
        }
        else {
            ({ index, _parent: parent } = this._tree);
        }
        for (; parent; { index, _parent: parent } = parent) {
            if (index > -1)
                for (let i = index + dir, e = dir < 0 ? -1 : parent._tree.children.length; i != e; i += dir) {
                    let child = parent._tree.children[i];
                    if ((this.mode & exports.IterMode.IncludeAnonymous) ||
                        child instanceof TreeBuffer ||
                        !child.type.isAnonymous ||
                        hasChild(child))
                        return false;
                }
        }
        return true;
    }
    move(dir, enter) {
        if (enter && this.enterChild(dir, 0, 4 /* Side.DontCare */))
            return true;
        for (;;) {
            if (this.sibling(dir))
                return true;
            if (this.atLastNode(dir) || !this.parent())
                return false;
        }
    }
    /**
    Move to the next node in a
    [pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
    traversal, going from a node to its first child or, if the
    current node is empty or `enter` is false, its next sibling or
    the next sibling of the first parent node that has one.
    */
    next(enter = true) { return this.move(1, enter); }
    /**
    Move to the next node in a last-to-first pre-order traversal. A
    node is followed by its last child or, if it has none, its
    previous sibling or the previous sibling of the first parent
    node that has one.
    */
    prev(enter = true) { return this.move(-1, enter); }
    /**
    Move the cursor to the innermost node that covers `pos`. If
    `side` is -1, it will enter nodes that end at `pos`. If it is 1,
    it will enter nodes that start at `pos`.
    */
    moveTo(pos, side = 0) {
        // Move up to a node that actually holds the position, if possible
        while (this.from == this.to ||
            (side < 1 ? this.from >= pos : this.from > pos) ||
            (side > -1 ? this.to <= pos : this.to < pos))
            if (!this.parent())
                break;
        // Then scan down into child nodes as far as possible
        while (this.enterChild(1, pos, side)) { }
        return this;
    }
    /**
    Get a [syntax node](#common.SyntaxNode) at the cursor's current
    position.
    */
    get node() {
        if (!this.buffer)
            return this._tree;
        let cache = this.bufferNode, result = null, depth = 0;
        if (cache && cache.context == this.buffer) {
            scan: for (let index = this.index, d = this.stack.length; d >= 0;) {
                for (let c = cache; c; c = c._parent)
                    if (c.index == index) {
                        if (index == this.index)
                            return c;
                        result = c;
                        depth = d + 1;
                        break scan;
                    }
                index = this.stack[--d];
            }
        }
        for (let i = depth; i < this.stack.length; i++)
            result = new BufferNode(this.buffer, result, this.stack[i]);
        return this.bufferNode = new BufferNode(this.buffer, result, this.index);
    }
    /**
    Get the [tree](#common.Tree) that represents the current node, if
    any. Will return null when the node is in a [tree
    buffer](#common.TreeBuffer).
    */
    get tree() {
        return this.buffer ? null : this._tree._tree;
    }
    /**
    Iterate over the current node and all its descendants, calling
    `enter` when entering a node and `leave`, if given, when leaving
    one. When `enter` returns `false`, any children of that node are
    skipped, and `leave` isn't called for it.
    */
    iterate(enter, leave) {
        for (let depth = 0;;) {
            let mustLeave = false;
            if (this.type.isAnonymous || enter(this) !== false) {
                if (this.firstChild()) {
                    depth++;
                    continue;
                }
                if (!this.type.isAnonymous)
                    mustLeave = true;
            }
            for (;;) {
                if (mustLeave && leave)
                    leave(this);
                mustLeave = this.type.isAnonymous;
                if (!depth)
                    return;
                if (this.nextSibling())
                    break;
                this.parent();
                depth--;
                mustLeave = true;
            }
        }
    }
    /**
    Test whether the current node matches a given context—a sequence
    of direct parent node names. Empty strings in the context array
    are treated as wildcards.
    */
    matchContext(context) {
        if (!this.buffer)
            return matchNodeContext(this.node.parent, context);
        let { buffer } = this.buffer, { types } = buffer.set;
        for (let i = context.length - 1, d = this.stack.length - 1; i >= 0; d--) {
            if (d < 0)
                return matchNodeContext(this._tree, context, i);
            let type = types[buffer.buffer[this.stack[d]]];
            if (!type.isAnonymous) {
                if (context[i] && context[i] != type.name)
                    return false;
                i--;
            }
        }
        return true;
    }
}
function hasChild(tree) {
    return tree.children.some(ch => ch instanceof TreeBuffer || !ch.type.isAnonymous || hasChild(ch));
}
function buildTree(data) {
    var _a;
    let { buffer, nodeSet, maxBufferLength = DefaultBufferLength, reused = [], minRepeatType = nodeSet.types.length } = data;
    let cursor = Array.isArray(buffer) ? new FlatBufferCursor(buffer, buffer.length) : buffer;
    let types = nodeSet.types;
    let contextHash = 0, lookAhead = 0;
    function takeNode(parentStart, minPos, children, positions, inRepeat, depth) {
        let { id, start, end, size } = cursor;
        let lookAheadAtStart = lookAhead, contextAtStart = contextHash;
        while (size < 0) {
            cursor.next();
            if (size == -1 /* SpecialRecord.Reuse */) {
                let node = reused[id];
                children.push(node);
                positions.push(start - parentStart);
                return;
            }
            else if (size == -3 /* SpecialRecord.ContextChange */) { // Context change
                contextHash = id;
                return;
            }
            else if (size == -4 /* SpecialRecord.LookAhead */) {
                lookAhead = id;
                return;
            }
            else {
                throw new RangeError(`Unrecognized record size: ${size}`);
            }
        }
        let type = types[id], node, buffer;
        let startPos = start - parentStart;
        if (end - start <= maxBufferLength && (buffer = findBufferSize(cursor.pos - minPos, inRepeat))) {
            // Small enough for a buffer, and no reused nodes inside
            let data = new Uint16Array(buffer.size - buffer.skip);
            let endPos = cursor.pos - buffer.size, index = data.length;
            while (cursor.pos > endPos)
                index = copyToBuffer(buffer.start, data, index);
            node = new TreeBuffer(data, end - buffer.start, nodeSet);
            startPos = buffer.start - parentStart;
        }
        else { // Make it a node
            let endPos = cursor.pos - size;
            cursor.next();
            let localChildren = [], localPositions = [];
            let localInRepeat = id >= minRepeatType ? id : -1;
            let lastGroup = 0, lastEnd = end;
            while (cursor.pos > endPos) {
                if (localInRepeat >= 0 && cursor.id == localInRepeat && cursor.size >= 0) {
                    if (cursor.end <= lastEnd - maxBufferLength) {
                        makeRepeatLeaf(localChildren, localPositions, start, lastGroup, cursor.end, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
                        lastGroup = localChildren.length;
                        lastEnd = cursor.end;
                    }
                    cursor.next();
                }
                else if (depth > 2500 /* CutOff.Depth */) {
                    takeFlatNode(start, endPos, localChildren, localPositions);
                }
                else {
                    takeNode(start, endPos, localChildren, localPositions, localInRepeat, depth + 1);
                }
            }
            if (localInRepeat >= 0 && lastGroup > 0 && lastGroup < localChildren.length)
                makeRepeatLeaf(localChildren, localPositions, start, lastGroup, start, lastEnd, localInRepeat, lookAheadAtStart, contextAtStart);
            localChildren.reverse();
            localPositions.reverse();
            if (localInRepeat > -1 && lastGroup > 0) {
                let make = makeBalanced(type, contextAtStart);
                node = balanceRange(type, localChildren, localPositions, 0, localChildren.length, 0, end - start, make, make);
            }
            else {
                node = makeTree(type, localChildren, localPositions, end - start, lookAheadAtStart - end, contextAtStart);
            }
        }
        children.push(node);
        positions.push(startPos);
    }
    function takeFlatNode(parentStart, minPos, children, positions) {
        let nodes = []; // Temporary, inverted array of leaf nodes found, with absolute positions
        let nodeCount = 0, stopAt = -1;
        while (cursor.pos > minPos) {
            let { id, start, end, size } = cursor;
            if (size > 4) { // Not a leaf
                cursor.next();
            }
            else if (stopAt > -1 && start < stopAt) {
                break;
            }
            else {
                if (stopAt < 0)
                    stopAt = end - maxBufferLength;
                nodes.push(id, start, end);
                nodeCount++;
                cursor.next();
            }
        }
        if (nodeCount) {
            let buffer = new Uint16Array(nodeCount * 4);
            let start = nodes[nodes.length - 2];
            for (let i = nodes.length - 3, j = 0; i >= 0; i -= 3) {
                buffer[j++] = nodes[i];
                buffer[j++] = nodes[i + 1] - start;
                buffer[j++] = nodes[i + 2] - start;
                buffer[j++] = j;
            }
            children.push(new TreeBuffer(buffer, nodes[2] - start, nodeSet));
            positions.push(start - parentStart);
        }
    }
    function makeBalanced(type, contextHash) {
        return (children, positions, length) => {
            let lookAhead = 0, lastI = children.length - 1, last, lookAheadProp;
            if (lastI >= 0 && (last = children[lastI]) instanceof Tree) {
                if (!lastI && last.type == type && last.length == length)
                    return last;
                if (lookAheadProp = last.prop(NodeProp.lookAhead))
                    lookAhead = positions[lastI] + last.length + lookAheadProp;
            }
            return makeTree(type, children, positions, length, lookAhead, contextHash);
        };
    }
    function makeRepeatLeaf(children, positions, base, i, from, to, type, lookAhead, contextHash) {
        let localChildren = [], localPositions = [];
        while (children.length > i) {
            localChildren.push(children.pop());
            localPositions.push(positions.pop() + base - from);
        }
        children.push(makeTree(nodeSet.types[type], localChildren, localPositions, to - from, lookAhead - to, contextHash));
        positions.push(from - base);
    }
    function makeTree(type, children, positions, length, lookAhead, contextHash, props) {
        if (contextHash) {
            let pair = [NodeProp.contextHash, contextHash];
            props = props ? [pair].concat(props) : [pair];
        }
        if (lookAhead > 25) {
            let pair = [NodeProp.lookAhead, lookAhead];
            props = props ? [pair].concat(props) : [pair];
        }
        return new Tree(type, children, positions, length, props);
    }
    function findBufferSize(maxSize, inRepeat) {
        // Scan through the buffer to find previous siblings that fit
        // together in a TreeBuffer, and don't contain any reused nodes
        // (which can't be stored in a buffer).
        // If `inRepeat` is > -1, ignore node boundaries of that type for
        // nesting, but make sure the end falls either at the start
        // (`maxSize`) or before such a node.
        let fork = cursor.fork();
        let size = 0, start = 0, skip = 0, minStart = fork.end - maxBufferLength;
        let result = { size: 0, start: 0, skip: 0 };
        scan: for (let minPos = fork.pos - maxSize; fork.pos > minPos;) {
            let nodeSize = fork.size;
            // Pretend nested repeat nodes of the same type don't exist
            if (fork.id == inRepeat && nodeSize >= 0) {
                // Except that we store the current state as a valid return
                // value.
                result.size = size;
                result.start = start;
                result.skip = skip;
                skip += 4;
                size += 4;
                fork.next();
                continue;
            }
            let startPos = fork.pos - nodeSize;
            if (nodeSize < 0 || startPos < minPos || fork.start < minStart)
                break;
            let localSkipped = fork.id >= minRepeatType ? 4 : 0;
            let nodeStart = fork.start;
            fork.next();
            while (fork.pos > startPos) {
                if (fork.size < 0) {
                    if (fork.size == -3 /* SpecialRecord.ContextChange */)
                        localSkipped += 4;
                    else
                        break scan;
                }
                else if (fork.id >= minRepeatType) {
                    localSkipped += 4;
                }
                fork.next();
            }
            start = nodeStart;
            size += nodeSize;
            skip += localSkipped;
        }
        if (inRepeat < 0 || size == maxSize) {
            result.size = size;
            result.start = start;
            result.skip = skip;
        }
        return result.size > 4 ? result : undefined;
    }
    function copyToBuffer(bufferStart, buffer, index) {
        let { id, start, end, size } = cursor;
        cursor.next();
        if (size >= 0 && id < minRepeatType) {
            let startIndex = index;
            if (size > 4) {
                let endPos = cursor.pos - (size - 4);
                while (cursor.pos > endPos)
                    index = copyToBuffer(bufferStart, buffer, index);
            }
            buffer[--index] = startIndex;
            buffer[--index] = end - bufferStart;
            buffer[--index] = start - bufferStart;
            buffer[--index] = id;
        }
        else if (size == -3 /* SpecialRecord.ContextChange */) {
            contextHash = id;
        }
        else if (size == -4 /* SpecialRecord.LookAhead */) {
            lookAhead = id;
        }
        return index;
    }
    let children = [], positions = [];
    while (cursor.pos > 0)
        takeNode(data.start || 0, data.bufferStart || 0, children, positions, -1, 0);
    let length = (_a = data.length) !== null && _a !== void 0 ? _a : (children.length ? positions[0] + children[0].length : 0);
    return new Tree(types[data.topID], children.reverse(), positions.reverse(), length);
}
const nodeSizeCache = new WeakMap;
function nodeSize(balanceType, node) {
    if (!balanceType.isAnonymous || node instanceof TreeBuffer || node.type != balanceType)
        return 1;
    let size = nodeSizeCache.get(node);
    if (size == null) {
        size = 1;
        for (let child of node.children) {
            if (child.type != balanceType || !(child instanceof Tree)) {
                size = 1;
                break;
            }
            size += nodeSize(balanceType, child);
        }
        nodeSizeCache.set(node, size);
    }
    return size;
}
function balanceRange(
// The type the balanced tree's inner nodes.
balanceType, 
// The direct children and their positions
children, positions, 
// The index range in children/positions to use
from, to, 
// The start position of the nodes, relative to their parent.
start, 
// Length of the outer node
length, 
// Function to build the top node of the balanced tree
mkTop, 
// Function to build internal nodes for the balanced tree
mkTree) {
    let total = 0;
    for (let i = from; i < to; i++)
        total += nodeSize(balanceType, children[i]);
    let maxChild = Math.ceil((total * 1.5) / 8 /* Balance.BranchFactor */);
    let localChildren = [], localPositions = [];
    function divide(children, positions, from, to, offset) {
        for (let i = from; i < to;) {
            let groupFrom = i, groupStart = positions[i], groupSize = nodeSize(balanceType, children[i]);
            i++;
            for (; i < to; i++) {
                let nextSize = nodeSize(balanceType, children[i]);
                if (groupSize + nextSize >= maxChild)
                    break;
                groupSize += nextSize;
            }
            if (i == groupFrom + 1) {
                if (groupSize > maxChild) {
                    let only = children[groupFrom]; // Only trees can have a size > 1
                    divide(only.children, only.positions, 0, only.children.length, positions[groupFrom] + offset);
                    continue;
                }
                localChildren.push(children[groupFrom]);
            }
            else {
                let length = positions[i - 1] + children[i - 1].length - groupStart;
                localChildren.push(balanceRange(balanceType, children, positions, groupFrom, i, groupStart, length, null, mkTree));
            }
            localPositions.push(groupStart + offset - start);
        }
    }
    divide(children, positions, from, to, 0);
    return (mkTop || mkTree)(localChildren, localPositions, length);
}
/**
Provides a way to associate values with pieces of trees. As long
as that part of the tree is reused, the associated values can be
retrieved from an updated tree.
*/
class NodeWeakMap {
    constructor() {
        this.map = new WeakMap();
    }
    setBuffer(buffer, index, value) {
        let inner = this.map.get(buffer);
        if (!inner)
            this.map.set(buffer, inner = new Map);
        inner.set(index, value);
    }
    getBuffer(buffer, index) {
        let inner = this.map.get(buffer);
        return inner && inner.get(index);
    }
    /**
    Set the value for this syntax node.
    */
    set(node, value) {
        if (node instanceof BufferNode)
            this.setBuffer(node.context.buffer, node.index, value);
        else if (node instanceof TreeNode)
            this.map.set(node.tree, value);
    }
    /**
    Retrieve value for this syntax node, if it exists in the map.
    */
    get(node) {
        return node instanceof BufferNode ? this.getBuffer(node.context.buffer, node.index)
            : node instanceof TreeNode ? this.map.get(node.tree) : undefined;
    }
    /**
    Set the value for the node that a cursor currently points to.
    */
    cursorSet(cursor, value) {
        if (cursor.buffer)
            this.setBuffer(cursor.buffer.buffer, cursor.index, value);
        else
            this.map.set(cursor.tree, value);
    }
    /**
    Retrieve the value for the node that a cursor currently points
    to.
    */
    cursorGet(cursor) {
        return cursor.buffer ? this.getBuffer(cursor.buffer.buffer, cursor.index) : this.map.get(cursor.tree);
    }
}

/**
Tree fragments are used during [incremental
parsing](#common.Parser.startParse) to track parts of old trees
that can be reused in a new parse. An array of fragments is used
to track regions of an old tree whose nodes might be reused in new
parses. Use the static
[`applyChanges`](#common.TreeFragment^applyChanges) method to
update fragments for document changes.
*/
class TreeFragment {
    /**
    Construct a tree fragment. You'll usually want to use
    [`addTree`](#common.TreeFragment^addTree) and
    [`applyChanges`](#common.TreeFragment^applyChanges) instead of
    calling this directly.
    */
    constructor(
    /**
    The start of the unchanged range pointed to by this fragment.
    This refers to an offset in the _updated_ document (as opposed
    to the original tree).
    */
    from, 
    /**
    The end of the unchanged range.
    */
    to, 
    /**
    The tree that this fragment is based on.
    */
    tree, 
    /**
    The offset between the fragment's tree and the document that
    this fragment can be used against. Add this when going from
    document to tree positions, subtract it to go from tree to
    document positions.
    */
    offset, openStart = false, openEnd = false) {
        this.from = from;
        this.to = to;
        this.tree = tree;
        this.offset = offset;
        this.open = (openStart ? 1 /* Open.Start */ : 0) | (openEnd ? 2 /* Open.End */ : 0);
    }
    /**
    Whether the start of the fragment represents the start of a
    parse, or the end of a change. (In the second case, it may not
    be safe to reuse some nodes at the start, depending on the
    parsing algorithm.)
    */
    get openStart() { return (this.open & 1 /* Open.Start */) > 0; }
    /**
    Whether the end of the fragment represents the end of a
    full-document parse, or the start of a change.
    */
    get openEnd() { return (this.open & 2 /* Open.End */) > 0; }
    /**
    Create a set of fragments from a freshly parsed tree, or update
    an existing set of fragments by replacing the ones that overlap
    with a tree with content from the new tree. When `partial` is
    true, the parse is treated as incomplete, and the resulting
    fragment has [`openEnd`](#common.TreeFragment.openEnd) set to
    true.
    */
    static addTree(tree, fragments = [], partial = false) {
        let result = [new TreeFragment(0, tree.length, tree, 0, false, partial)];
        for (let f of fragments)
            if (f.to > tree.length)
                result.push(f);
        return result;
    }
    /**
    Apply a set of edits to an array of fragments, removing or
    splitting fragments as necessary to remove edited ranges, and
    adjusting offsets for fragments that moved.
    */
    static applyChanges(fragments, changes, minGap = 128) {
        if (!changes.length)
            return fragments;
        let result = [];
        let fI = 1, nextF = fragments.length ? fragments[0] : null;
        for (let cI = 0, pos = 0, off = 0;; cI++) {
            let nextC = cI < changes.length ? changes[cI] : null;
            let nextPos = nextC ? nextC.fromA : 1e9;
            if (nextPos - pos >= minGap)
                while (nextF && nextF.from < nextPos) {
                    let cut = nextF;
                    if (pos >= cut.from || nextPos <= cut.to || off) {
                        let fFrom = Math.max(cut.from, pos) - off, fTo = Math.min(cut.to, nextPos) - off;
                        cut = fFrom >= fTo ? null : new TreeFragment(fFrom, fTo, cut.tree, cut.offset + off, cI > 0, !!nextC);
                    }
                    if (cut)
                        result.push(cut);
                    if (nextF.to > nextPos)
                        break;
                    nextF = fI < fragments.length ? fragments[fI++] : null;
                }
            if (!nextC)
                break;
            pos = nextC.toA;
            off = nextC.toA - nextC.toB;
        }
        return result;
    }
}
/**
A superclass that parsers should extend.
*/
class Parser {
    /**
    Start a parse, returning a [partial parse](#common.PartialParse)
    object. [`fragments`](#common.TreeFragment) can be passed in to
    make the parse incremental.
    
    By default, the entire input is parsed. You can pass `ranges`,
    which should be a sorted array of non-empty, non-overlapping
    ranges, to parse only those ranges. The tree returned in that
    case will start at `ranges[0].from`.
    */
    startParse(input, fragments, ranges) {
        if (typeof input == "string")
            input = new StringInput(input);
        ranges = !ranges ? [new Range(0, input.length)] : ranges.length ? ranges.map(r => new Range(r.from, r.to)) : [new Range(0, 0)];
        return this.createParse(input, fragments || [], ranges);
    }
    /**
    Run a full parse, returning the resulting tree.
    */
    parse(input, fragments, ranges) {
        let parse = this.startParse(input, fragments, ranges);
        for (;;) {
            let done = parse.advance();
            if (done)
                return done;
        }
    }
}
class StringInput {
    constructor(string) {
        this.string = string;
    }
    get length() { return this.string.length; }
    chunk(from) { return this.string.slice(from); }
    get lineChunks() { return false; }
    read(from, to) { return this.string.slice(from, to); }
}

/**
Create a parse wrapper that, after the inner parse completes,
scans its tree for mixed language regions with the `nest`
function, runs the resulting [inner parses](#common.NestedParse),
and then [mounts](#common.NodeProp^mounted) their results onto the
tree.
*/
function parseMixed(nest) {
    return (parse, input, fragments, ranges) => new MixedParse(parse, nest, input, fragments, ranges);
}
class InnerParse {
    constructor(parser, parse, overlay, target, from) {
        this.parser = parser;
        this.parse = parse;
        this.overlay = overlay;
        this.target = target;
        this.from = from;
    }
}
function checkRanges(ranges) {
    if (!ranges.length || ranges.some(r => r.from >= r.to))
        throw new RangeError("Invalid inner parse ranges given: " + JSON.stringify(ranges));
}
class ActiveOverlay {
    constructor(parser, predicate, mounts, index, start, target, prev) {
        this.parser = parser;
        this.predicate = predicate;
        this.mounts = mounts;
        this.index = index;
        this.start = start;
        this.target = target;
        this.prev = prev;
        this.depth = 0;
        this.ranges = [];
    }
}
const stoppedInner = new NodeProp({ perNode: true });
class MixedParse {
    constructor(base, nest, input, fragments, ranges) {
        this.nest = nest;
        this.input = input;
        this.fragments = fragments;
        this.ranges = ranges;
        this.inner = [];
        this.innerDone = 0;
        this.baseTree = null;
        this.stoppedAt = null;
        this.baseParse = base;
    }
    advance() {
        if (this.baseParse) {
            let done = this.baseParse.advance();
            if (!done)
                return null;
            this.baseParse = null;
            this.baseTree = done;
            this.startInner();
            if (this.stoppedAt != null)
                for (let inner of this.inner)
                    inner.parse.stopAt(this.stoppedAt);
        }
        if (this.innerDone == this.inner.length) {
            let result = this.baseTree;
            if (this.stoppedAt != null)
                result = new Tree(result.type, result.children, result.positions, result.length, result.propValues.concat([[stoppedInner, this.stoppedAt]]));
            return result;
        }
        let inner = this.inner[this.innerDone], done = inner.parse.advance();
        if (done) {
            this.innerDone++;
            // This is a somewhat dodgy but super helpful hack where we
            // patch up nodes created by the inner parse (and thus
            // presumably not aliased anywhere else) to hold the information
            // about the inner parse.
            let props = Object.assign(Object.create(null), inner.target.props);
            props[NodeProp.mounted.id] = new MountedTree(done, inner.overlay, inner.parser);
            inner.target.props = props;
        }
        return null;
    }
    get parsedPos() {
        if (this.baseParse)
            return 0;
        let pos = this.input.length;
        for (let i = this.innerDone; i < this.inner.length; i++) {
            if (this.inner[i].from < pos)
                pos = Math.min(pos, this.inner[i].parse.parsedPos);
        }
        return pos;
    }
    stopAt(pos) {
        this.stoppedAt = pos;
        if (this.baseParse)
            this.baseParse.stopAt(pos);
        else
            for (let i = this.innerDone; i < this.inner.length; i++)
                this.inner[i].parse.stopAt(pos);
    }
    startInner() {
        let fragmentCursor = new FragmentCursor$1(this.fragments);
        let overlay = null;
        let covered = null;
        let cursor = new TreeCursor(new TreeNode(this.baseTree, this.ranges[0].from, 0, null), exports.IterMode.IncludeAnonymous | exports.IterMode.IgnoreMounts);
        scan: for (let nest, isCovered;;) {
            let enter = true, range;
            if (this.stoppedAt != null && cursor.from >= this.stoppedAt) {
                enter = false;
            }
            else if (fragmentCursor.hasNode(cursor)) {
                if (overlay) {
                    let match = overlay.mounts.find(m => m.frag.from <= cursor.from && m.frag.to >= cursor.to && m.mount.overlay);
                    if (match)
                        for (let r of match.mount.overlay) {
                            let from = r.from + match.pos, to = r.to + match.pos;
                            if (from >= cursor.from && to <= cursor.to && !overlay.ranges.some(r => r.from < to && r.to > from))
                                overlay.ranges.push({ from, to });
                        }
                }
                enter = false;
            }
            else if (covered && (isCovered = checkCover(covered.ranges, cursor.from, cursor.to))) {
                enter = isCovered != 2 /* Cover.Full */;
            }
            else if (!cursor.type.isAnonymous && (nest = this.nest(cursor, this.input)) &&
                (cursor.from < cursor.to || !nest.overlay)) {
                if (!cursor.tree)
                    materialize(cursor);
                let oldMounts = fragmentCursor.findMounts(cursor.from, nest.parser);
                if (typeof nest.overlay == "function") {
                    overlay = new ActiveOverlay(nest.parser, nest.overlay, oldMounts, this.inner.length, cursor.from, cursor.tree, overlay);
                }
                else {
                    let ranges = punchRanges(this.ranges, nest.overlay ||
                        (cursor.from < cursor.to ? [new Range(cursor.from, cursor.to)] : []));
                    if (ranges.length)
                        checkRanges(ranges);
                    if (ranges.length || !nest.overlay)
                        this.inner.push(new InnerParse(nest.parser, ranges.length ? nest.parser.startParse(this.input, enterFragments(oldMounts, ranges), ranges)
                            : nest.parser.startParse(""), nest.overlay ? nest.overlay.map(r => new Range(r.from - cursor.from, r.to - cursor.from)) : null, cursor.tree, ranges.length ? ranges[0].from : cursor.from));
                    if (!nest.overlay)
                        enter = false;
                    else if (ranges.length)
                        covered = { ranges, depth: 0, prev: covered };
                }
            }
            else if (overlay && (range = overlay.predicate(cursor))) {
                if (range === true)
                    range = new Range(cursor.from, cursor.to);
                if (range.from < range.to) {
                    let last = overlay.ranges.length - 1;
                    if (last >= 0 && overlay.ranges[last].to == range.from)
                        overlay.ranges[last] = { from: overlay.ranges[last].from, to: range.to };
                    else
                        overlay.ranges.push(range);
                }
            }
            if (enter && cursor.firstChild()) {
                if (overlay)
                    overlay.depth++;
                if (covered)
                    covered.depth++;
            }
            else {
                for (;;) {
                    if (cursor.nextSibling())
                        break;
                    if (!cursor.parent())
                        break scan;
                    if (overlay && !--overlay.depth) {
                        let ranges = punchRanges(this.ranges, overlay.ranges);
                        if (ranges.length) {
                            checkRanges(ranges);
                            this.inner.splice(overlay.index, 0, new InnerParse(overlay.parser, overlay.parser.startParse(this.input, enterFragments(overlay.mounts, ranges), ranges), overlay.ranges.map(r => new Range(r.from - overlay.start, r.to - overlay.start)), overlay.target, ranges[0].from));
                        }
                        overlay = overlay.prev;
                    }
                    if (covered && !--covered.depth)
                        covered = covered.prev;
                }
            }
        }
    }
}
function checkCover(covered, from, to) {
    for (let range of covered) {
        if (range.from >= to)
            break;
        if (range.to > from)
            return range.from <= from && range.to >= to ? 2 /* Cover.Full */ : 1 /* Cover.Partial */;
    }
    return 0 /* Cover.None */;
}
// Take a piece of buffer and convert it into a stand-alone
// TreeBuffer.
function sliceBuf(buf, startI, endI, nodes, positions, off) {
    if (startI < endI) {
        let from = buf.buffer[startI + 1];
        nodes.push(buf.slice(startI, endI, from));
        positions.push(from - off);
    }
}
// This function takes a node that's in a buffer, and converts it, and
// its parent buffer nodes, into a Tree. This is again acting on the
// assumption that the trees and buffers have been constructed by the
// parse that was ran via the mix parser, and thus aren't shared with
// any other code, making violations of the immutability safe.
function materialize(cursor) {
    let { node } = cursor, stack = [];
    let buffer = node.context.buffer;
    // Scan up to the nearest tree
    do {
        stack.push(cursor.index);
        cursor.parent();
    } while (!cursor.tree);
    // Find the index of the buffer in that tree
    let base = cursor.tree, i = base.children.indexOf(buffer);
    let buf = base.children[i], b = buf.buffer, newStack = [i];
    // Split a level in the buffer, putting the nodes before and after
    // the child that contains `node` into new buffers.
    function split(startI, endI, type, innerOffset, length, stackPos) {
        let targetI = stack[stackPos];
        let children = [], positions = [];
        sliceBuf(buf, startI, targetI, children, positions, innerOffset);
        let from = b[targetI + 1], to = b[targetI + 2];
        newStack.push(children.length);
        let child = stackPos
            ? split(targetI + 4, b[targetI + 3], buf.set.types[b[targetI]], from, to - from, stackPos - 1)
            : node.toTree();
        children.push(child);
        positions.push(from - innerOffset);
        sliceBuf(buf, b[targetI + 3], endI, children, positions, innerOffset);
        return new Tree(type, children, positions, length);
    }
    base.children[i] = split(0, b.length, NodeType.none, 0, buf.length, stack.length - 1);
    // Move the cursor back to the target node
    for (let index of newStack) {
        let tree = cursor.tree.children[index], pos = cursor.tree.positions[index];
        cursor.yield(new TreeNode(tree, pos + cursor.from, index, cursor._tree));
    }
}
class StructureCursor {
    constructor(root, offset) {
        this.offset = offset;
        this.done = false;
        this.cursor = root.cursor(exports.IterMode.IncludeAnonymous | exports.IterMode.IgnoreMounts);
    }
    // Move to the first node (in pre-order) that starts at or after `pos`.
    moveTo(pos) {
        let { cursor } = this, p = pos - this.offset;
        while (!this.done && cursor.from < p) {
            if (cursor.to >= pos && cursor.enter(p, 1, exports.IterMode.IgnoreOverlays | exports.IterMode.ExcludeBuffers)) ;
            else if (!cursor.next(false))
                this.done = true;
        }
    }
    hasNode(cursor) {
        this.moveTo(cursor.from);
        if (!this.done && this.cursor.from + this.offset == cursor.from && this.cursor.tree) {
            for (let tree = this.cursor.tree;;) {
                if (tree == cursor.tree)
                    return true;
                if (tree.children.length && tree.positions[0] == 0 && tree.children[0] instanceof Tree)
                    tree = tree.children[0];
                else
                    break;
            }
        }
        return false;
    }
}
let FragmentCursor$1 = class FragmentCursor {
    constructor(fragments) {
        var _a;
        this.fragments = fragments;
        this.curTo = 0;
        this.fragI = 0;
        if (fragments.length) {
            let first = this.curFrag = fragments[0];
            this.curTo = (_a = first.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : first.to;
            this.inner = new StructureCursor(first.tree, -first.offset);
        }
        else {
            this.curFrag = this.inner = null;
        }
    }
    hasNode(node) {
        while (this.curFrag && node.from >= this.curTo)
            this.nextFrag();
        return this.curFrag && this.curFrag.from <= node.from && this.curTo >= node.to && this.inner.hasNode(node);
    }
    nextFrag() {
        var _a;
        this.fragI++;
        if (this.fragI == this.fragments.length) {
            this.curFrag = this.inner = null;
        }
        else {
            let frag = this.curFrag = this.fragments[this.fragI];
            this.curTo = (_a = frag.tree.prop(stoppedInner)) !== null && _a !== void 0 ? _a : frag.to;
            this.inner = new StructureCursor(frag.tree, -frag.offset);
        }
    }
    findMounts(pos, parser) {
        var _a;
        let result = [];
        if (this.inner) {
            this.inner.cursor.moveTo(pos, 1);
            for (let pos = this.inner.cursor.node; pos; pos = pos.parent) {
                let mount = (_a = pos.tree) === null || _a === void 0 ? void 0 : _a.prop(NodeProp.mounted);
                if (mount && mount.parser == parser) {
                    for (let i = this.fragI; i < this.fragments.length; i++) {
                        let frag = this.fragments[i];
                        if (frag.from >= pos.to)
                            break;
                        if (frag.tree == this.curFrag.tree)
                            result.push({
                                frag,
                                pos: pos.from - frag.offset,
                                mount
                            });
                    }
                }
            }
        }
        return result;
    }
};
function punchRanges(outer, ranges) {
    let copy = null, current = ranges;
    for (let i = 1, j = 0; i < outer.length; i++) {
        let gapFrom = outer[i - 1].to, gapTo = outer[i].from;
        for (; j < current.length; j++) {
            let r = current[j];
            if (r.from >= gapTo)
                break;
            if (r.to <= gapFrom)
                continue;
            if (!copy)
                current = copy = ranges.slice();
            if (r.from < gapFrom) {
                copy[j] = new Range(r.from, gapFrom);
                if (r.to > gapTo)
                    copy.splice(j + 1, 0, new Range(gapTo, r.to));
            }
            else if (r.to > gapTo) {
                copy[j--] = new Range(gapTo, r.to);
            }
            else {
                copy.splice(j--, 1);
            }
        }
    }
    return current;
}
function findCoverChanges(a, b, from, to) {
    let iA = 0, iB = 0, inA = false, inB = false, pos = -1e9;
    let result = [];
    for (;;) {
        let nextA = iA == a.length ? 1e9 : inA ? a[iA].to : a[iA].from;
        let nextB = iB == b.length ? 1e9 : inB ? b[iB].to : b[iB].from;
        if (inA != inB) {
            let start = Math.max(pos, from), end = Math.min(nextA, nextB, to);
            if (start < end)
                result.push(new Range(start, end));
        }
        pos = Math.min(nextA, nextB);
        if (pos == 1e9)
            break;
        if (nextA == pos) {
            if (!inA)
                inA = true;
            else {
                inA = false;
                iA++;
            }
        }
        if (nextB == pos) {
            if (!inB)
                inB = true;
            else {
                inB = false;
                iB++;
            }
        }
    }
    return result;
}
// Given a number of fragments for the outer tree, and a set of ranges
// to parse, find fragments for inner trees mounted around those
// ranges, if any.
function enterFragments(mounts, ranges) {
    let result = [];
    for (let { pos, mount, frag } of mounts) {
        let startPos = pos + (mount.overlay ? mount.overlay[0].from : 0), endPos = startPos + mount.tree.length;
        let from = Math.max(frag.from, startPos), to = Math.min(frag.to, endPos);
        if (mount.overlay) {
            let overlay = mount.overlay.map(r => new Range(r.from + pos, r.to + pos));
            let changes = findCoverChanges(ranges, overlay, from, to);
            for (let i = 0, pos = from;; i++) {
                let last = i == changes.length, end = last ? to : changes[i].from;
                if (end > pos)
                    result.push(new TreeFragment(pos, end, mount.tree, -startPos, frag.from >= pos || frag.openStart, frag.to <= end || frag.openEnd));
                if (last)
                    break;
                pos = changes[i].to;
            }
        }
        else {
            result.push(new TreeFragment(from, to, mount.tree, -startPos, frag.from >= startPos || frag.openStart, frag.to <= endPos || frag.openEnd));
        }
    }
    return result;
}

/**
A parse stack. These are used internally by the parser to track
parsing progress. They also provide some properties and methods
that external code such as a tokenizer can use to get information
about the parse state.
*/
class Stack {
    /**
    @internal
    */
    constructor(
    /**
    The parse that this stack is part of @internal
    */
    p, 
    /**
    Holds state, input pos, buffer index triplets for all but the
    top state @internal
    */
    stack, 
    /**
    The current parse state @internal
    */
    state, 
    // The position at which the next reduce should take place. This
    // can be less than `this.pos` when skipped expressions have been
    // added to the stack (which should be moved outside of the next
    // reduction)
    /**
    @internal
    */
    reducePos, 
    /**
    The input position up to which this stack has parsed.
    */
    pos, 
    /**
    The dynamic score of the stack, including dynamic precedence
    and error-recovery penalties
    @internal
    */
    score, 
    // The output buffer. Holds (type, start, end, size) quads
    // representing nodes created by the parser, where `size` is
    // amount of buffer array entries covered by this node.
    /**
    @internal
    */
    buffer, 
    // The base offset of the buffer. When stacks are split, the split
    // instance shared the buffer history with its parent up to
    // `bufferBase`, which is the absolute offset (including the
    // offset of previous splits) into the buffer at which this stack
    // starts writing.
    /**
    @internal
    */
    bufferBase, 
    /**
    @internal
    */
    curContext, 
    /**
    @internal
    */
    lookAhead = 0, 
    // A parent stack from which this was split off, if any. This is
    // set up so that it always points to a stack that has some
    // additional buffer content, never to a stack with an equal
    // `bufferBase`.
    /**
    @internal
    */
    parent) {
        this.p = p;
        this.stack = stack;
        this.state = state;
        this.reducePos = reducePos;
        this.pos = pos;
        this.score = score;
        this.buffer = buffer;
        this.bufferBase = bufferBase;
        this.curContext = curContext;
        this.lookAhead = lookAhead;
        this.parent = parent;
    }
    /**
    @internal
    */
    toString() {
        return `[${this.stack.filter((_, i) => i % 3 == 0).concat(this.state)}]@${this.pos}${this.score ? "!" + this.score : ""}`;
    }
    // Start an empty stack
    /**
    @internal
    */
    static start(p, state, pos = 0) {
        let cx = p.parser.context;
        return new Stack(p, [], state, pos, pos, 0, [], 0, cx ? new StackContext(cx, cx.start) : null, 0, null);
    }
    /**
    The stack's current [context](#lr.ContextTracker) value, if
    any. Its type will depend on the context tracker's type
    parameter, or it will be `null` if there is no context
    tracker.
    */
    get context() { return this.curContext ? this.curContext.context : null; }
    // Push a state onto the stack, tracking its start position as well
    // as the buffer base at that point.
    /**
    @internal
    */
    pushState(state, start) {
        this.stack.push(this.state, start, this.bufferBase + this.buffer.length);
        this.state = state;
    }
    // Apply a reduce action
    /**
    @internal
    */
    reduce(action) {
        var _a;
        let depth = action >> 19 /* Action.ReduceDepthShift */, type = action & 65535 /* Action.ValueMask */;
        let { parser } = this.p;
        let lookaheadRecord = this.reducePos < this.pos - 25 /* Lookahead.Margin */;
        if (lookaheadRecord)
            this.setLookAhead(this.pos);
        let dPrec = parser.dynamicPrecedence(type);
        if (dPrec)
            this.score += dPrec;
        if (depth == 0) {
            this.pushState(parser.getGoto(this.state, type, true), this.reducePos);
            // Zero-depth reductions are a special case—they add stuff to
            // the stack without popping anything off.
            if (type < parser.minRepeatTerm)
                this.storeNode(type, this.reducePos, this.reducePos, lookaheadRecord ? 8 : 4, true);
            this.reduceContext(type, this.reducePos);
            return;
        }
        // Find the base index into `this.stack`, content after which will
        // be dropped. Note that with `StayFlag` reductions we need to
        // consume two extra frames (the dummy parent node for the skipped
        // expression and the state that we'll be staying in, which should
        // be moved to `this.state`).
        let base = this.stack.length - ((depth - 1) * 3) - (action & 262144 /* Action.StayFlag */ ? 6 : 0);
        let start = base ? this.stack[base - 2] : this.p.ranges[0].from, size = this.reducePos - start;
        // This is a kludge to try and detect overly deep left-associative
        // trees, which will not increase the parse stack depth and thus
        // won't be caught by the regular stack-depth limit check.
        if (size >= 2000 /* Recover.MinBigReduction */ && !((_a = this.p.parser.nodeSet.types[type]) === null || _a === void 0 ? void 0 : _a.isAnonymous)) {
            if (start == this.p.lastBigReductionStart) {
                this.p.bigReductionCount++;
                this.p.lastBigReductionSize = size;
            }
            else if (this.p.lastBigReductionSize < size) {
                this.p.bigReductionCount = 1;
                this.p.lastBigReductionStart = start;
                this.p.lastBigReductionSize = size;
            }
        }
        let bufferBase = base ? this.stack[base - 1] : 0, count = this.bufferBase + this.buffer.length - bufferBase;
        // Store normal terms or `R -> R R` repeat reductions
        if (type < parser.minRepeatTerm || (action & 131072 /* Action.RepeatFlag */)) {
            let pos = parser.stateFlag(this.state, 1 /* StateFlag.Skipped */) ? this.pos : this.reducePos;
            this.storeNode(type, start, pos, count + 4, true);
        }
        if (action & 262144 /* Action.StayFlag */) {
            this.state = this.stack[base];
        }
        else {
            let baseStateID = this.stack[base - 3];
            this.state = parser.getGoto(baseStateID, type, true);
        }
        while (this.stack.length > base)
            this.stack.pop();
        this.reduceContext(type, start);
    }
    // Shift a value into the buffer
    /**
    @internal
    */
    storeNode(term, start, end, size = 4, mustSink = false) {
        if (term == 0 /* Term.Err */ &&
            (!this.stack.length || this.stack[this.stack.length - 1] < this.buffer.length + this.bufferBase)) {
            // Try to omit/merge adjacent error nodes
            let cur = this, top = this.buffer.length;
            if (top == 0 && cur.parent) {
                top = cur.bufferBase - cur.parent.bufferBase;
                cur = cur.parent;
            }
            if (top > 0 && cur.buffer[top - 4] == 0 /* Term.Err */ && cur.buffer[top - 1] > -1) {
                if (start == end)
                    return;
                if (cur.buffer[top - 2] >= start) {
                    cur.buffer[top - 2] = end;
                    return;
                }
            }
        }
        if (!mustSink || this.pos == end) { // Simple case, just append
            this.buffer.push(term, start, end, size);
        }
        else { // There may be skipped nodes that have to be moved forward
            let index = this.buffer.length;
            if (index > 0 && this.buffer[index - 4] != 0 /* Term.Err */) {
                let mustMove = false;
                for (let scan = index; scan > 0 && this.buffer[scan - 2] > end; scan -= 4) {
                    if (this.buffer[scan - 1] >= 0) {
                        mustMove = true;
                        break;
                    }
                }
                if (mustMove)
                    while (index > 0 && this.buffer[index - 2] > end) {
                        // Move this record forward
                        this.buffer[index] = this.buffer[index - 4];
                        this.buffer[index + 1] = this.buffer[index - 3];
                        this.buffer[index + 2] = this.buffer[index - 2];
                        this.buffer[index + 3] = this.buffer[index - 1];
                        index -= 4;
                        if (size > 4)
                            size -= 4;
                    }
            }
            this.buffer[index] = term;
            this.buffer[index + 1] = start;
            this.buffer[index + 2] = end;
            this.buffer[index + 3] = size;
        }
    }
    // Apply a shift action
    /**
    @internal
    */
    shift(action, type, start, end) {
        if (action & 131072 /* Action.GotoFlag */) {
            this.pushState(action & 65535 /* Action.ValueMask */, this.pos);
        }
        else if ((action & 262144 /* Action.StayFlag */) == 0) { // Regular shift
            let nextState = action, { parser } = this.p;
            if (end > this.pos || type <= parser.maxNode) {
                this.pos = end;
                if (!parser.stateFlag(nextState, 1 /* StateFlag.Skipped */))
                    this.reducePos = end;
            }
            this.pushState(nextState, start);
            this.shiftContext(type, start);
            if (type <= parser.maxNode)
                this.buffer.push(type, start, end, 4);
        }
        else { // Shift-and-stay, which means this is a skipped token
            this.pos = end;
            this.shiftContext(type, start);
            if (type <= this.p.parser.maxNode)
                this.buffer.push(type, start, end, 4);
        }
    }
    // Apply an action
    /**
    @internal
    */
    apply(action, next, nextStart, nextEnd) {
        if (action & 65536 /* Action.ReduceFlag */)
            this.reduce(action);
        else
            this.shift(action, next, nextStart, nextEnd);
    }
    // Add a prebuilt (reused) node into the buffer.
    /**
    @internal
    */
    useNode(value, next) {
        let index = this.p.reused.length - 1;
        if (index < 0 || this.p.reused[index] != value) {
            this.p.reused.push(value);
            index++;
        }
        let start = this.pos;
        this.reducePos = this.pos = start + value.length;
        this.pushState(next, start);
        this.buffer.push(index, start, this.reducePos, -1 /* size == -1 means this is a reused value */);
        if (this.curContext)
            this.updateContext(this.curContext.tracker.reuse(this.curContext.context, value, this, this.p.stream.reset(this.pos - value.length)));
    }
    // Split the stack. Due to the buffer sharing and the fact
    // that `this.stack` tends to stay quite shallow, this isn't very
    // expensive.
    /**
    @internal
    */
    split() {
        let parent = this;
        let off = parent.buffer.length;
        // Because the top of the buffer (after this.pos) may be mutated
        // to reorder reductions and skipped tokens, and shared buffers
        // should be immutable, this copies any outstanding skipped tokens
        // to the new buffer, and puts the base pointer before them.
        while (off > 0 && parent.buffer[off - 2] > parent.reducePos)
            off -= 4;
        let buffer = parent.buffer.slice(off), base = parent.bufferBase + off;
        // Make sure parent points to an actual parent with content, if there is such a parent.
        while (parent && base == parent.bufferBase)
            parent = parent.parent;
        return new Stack(this.p, this.stack.slice(), this.state, this.reducePos, this.pos, this.score, buffer, base, this.curContext, this.lookAhead, parent);
    }
    // Try to recover from an error by 'deleting' (ignoring) one token.
    /**
    @internal
    */
    recoverByDelete(next, nextEnd) {
        let isNode = next <= this.p.parser.maxNode;
        if (isNode)
            this.storeNode(next, this.pos, nextEnd, 4);
        this.storeNode(0 /* Term.Err */, this.pos, nextEnd, isNode ? 8 : 4);
        this.pos = this.reducePos = nextEnd;
        this.score -= 190 /* Recover.Delete */;
    }
    /**
    Check if the given term would be able to be shifted (optionally
    after some reductions) on this stack. This can be useful for
    external tokenizers that want to make sure they only provide a
    given token when it applies.
    */
    canShift(term) {
        for (let sim = new SimulatedStack(this);;) {
            let action = this.p.parser.stateSlot(sim.state, 4 /* ParseState.DefaultReduce */) || this.p.parser.hasAction(sim.state, term);
            if (action == 0)
                return false;
            if ((action & 65536 /* Action.ReduceFlag */) == 0)
                return true;
            sim.reduce(action);
        }
    }
    // Apply up to Recover.MaxNext recovery actions that conceptually
    // inserts some missing token or rule.
    /**
    @internal
    */
    recoverByInsert(next) {
        if (this.stack.length >= 300 /* Recover.MaxInsertStackDepth */)
            return [];
        let nextStates = this.p.parser.nextStates(this.state);
        if (nextStates.length > 4 /* Recover.MaxNext */ << 1 || this.stack.length >= 120 /* Recover.DampenInsertStackDepth */) {
            let best = [];
            for (let i = 0, s; i < nextStates.length; i += 2) {
                if ((s = nextStates[i + 1]) != this.state && this.p.parser.hasAction(s, next))
                    best.push(nextStates[i], s);
            }
            if (this.stack.length < 120 /* Recover.DampenInsertStackDepth */)
                for (let i = 0; best.length < 4 /* Recover.MaxNext */ << 1 && i < nextStates.length; i += 2) {
                    let s = nextStates[i + 1];
                    if (!best.some((v, i) => (i & 1) && v == s))
                        best.push(nextStates[i], s);
                }
            nextStates = best;
        }
        let result = [];
        for (let i = 0; i < nextStates.length && result.length < 4 /* Recover.MaxNext */; i += 2) {
            let s = nextStates[i + 1];
            if (s == this.state)
                continue;
            let stack = this.split();
            stack.pushState(s, this.pos);
            stack.storeNode(0 /* Term.Err */, stack.pos, stack.pos, 4, true);
            stack.shiftContext(nextStates[i], this.pos);
            stack.reducePos = this.pos;
            stack.score -= 200 /* Recover.Insert */;
            result.push(stack);
        }
        return result;
    }
    // Force a reduce, if possible. Return false if that can't
    // be done.
    /**
    @internal
    */
    forceReduce() {
        let { parser } = this.p;
        let reduce = parser.stateSlot(this.state, 5 /* ParseState.ForcedReduce */);
        if ((reduce & 65536 /* Action.ReduceFlag */) == 0)
            return false;
        if (!parser.validAction(this.state, reduce)) {
            let depth = reduce >> 19 /* Action.ReduceDepthShift */, term = reduce & 65535 /* Action.ValueMask */;
            let target = this.stack.length - depth * 3;
            if (target < 0 || parser.getGoto(this.stack[target], term, false) < 0) {
                let backup = this.findForcedReduction();
                if (backup == null)
                    return false;
                reduce = backup;
            }
            this.storeNode(0 /* Term.Err */, this.pos, this.pos, 4, true);
            this.score -= 100 /* Recover.Reduce */;
        }
        this.reducePos = this.pos;
        this.reduce(reduce);
        return true;
    }
    /**
    Try to scan through the automaton to find some kind of reduction
    that can be applied. Used when the regular ForcedReduce field
    isn't a valid action. @internal
    */
    findForcedReduction() {
        let { parser } = this.p, seen = [];
        let explore = (state, depth) => {
            if (seen.includes(state))
                return;
            seen.push(state);
            return parser.allActions(state, (action) => {
                if (action & (262144 /* Action.StayFlag */ | 131072 /* Action.GotoFlag */)) ;
                else if (action & 65536 /* Action.ReduceFlag */) {
                    let rDepth = (action >> 19 /* Action.ReduceDepthShift */) - depth;
                    if (rDepth > 1) {
                        let term = action & 65535 /* Action.ValueMask */, target = this.stack.length - rDepth * 3;
                        if (target >= 0 && parser.getGoto(this.stack[target], term, false) >= 0)
                            return (rDepth << 19 /* Action.ReduceDepthShift */) | 65536 /* Action.ReduceFlag */ | term;
                    }
                }
                else {
                    let found = explore(action, depth + 1);
                    if (found != null)
                        return found;
                }
            });
        };
        return explore(this.state, 0);
    }
    /**
    @internal
    */
    forceAll() {
        while (!this.p.parser.stateFlag(this.state, 2 /* StateFlag.Accepting */)) {
            if (!this.forceReduce()) {
                this.storeNode(0 /* Term.Err */, this.pos, this.pos, 4, true);
                break;
            }
        }
        return this;
    }
    /**
    Check whether this state has no further actions (assumed to be a direct descendant of the
    top state, since any other states must be able to continue
    somehow). @internal
    */
    get deadEnd() {
        if (this.stack.length != 3)
            return false;
        let { parser } = this.p;
        return parser.data[parser.stateSlot(this.state, 1 /* ParseState.Actions */)] == 65535 /* Seq.End */ &&
            !parser.stateSlot(this.state, 4 /* ParseState.DefaultReduce */);
    }
    /**
    Restart the stack (put it back in its start state). Only safe
    when this.stack.length == 3 (state is directly below the top
    state). @internal
    */
    restart() {
        this.storeNode(0 /* Term.Err */, this.pos, this.pos, 4, true);
        this.state = this.stack[0];
        this.stack.length = 0;
    }
    /**
    @internal
    */
    sameState(other) {
        if (this.state != other.state || this.stack.length != other.stack.length)
            return false;
        for (let i = 0; i < this.stack.length; i += 3)
            if (this.stack[i] != other.stack[i])
                return false;
        return true;
    }
    /**
    Get the parser used by this stack.
    */
    get parser() { return this.p.parser; }
    /**
    Test whether a given dialect (by numeric ID, as exported from
    the terms file) is enabled.
    */
    dialectEnabled(dialectID) { return this.p.parser.dialect.flags[dialectID]; }
    shiftContext(term, start) {
        if (this.curContext)
            this.updateContext(this.curContext.tracker.shift(this.curContext.context, term, this, this.p.stream.reset(start)));
    }
    reduceContext(term, start) {
        if (this.curContext)
            this.updateContext(this.curContext.tracker.reduce(this.curContext.context, term, this, this.p.stream.reset(start)));
    }
    /**
    @internal
    */
    emitContext() {
        let last = this.buffer.length - 1;
        if (last < 0 || this.buffer[last] != -3)
            this.buffer.push(this.curContext.hash, this.pos, this.pos, -3);
    }
    /**
    @internal
    */
    emitLookAhead() {
        let last = this.buffer.length - 1;
        if (last < 0 || this.buffer[last] != -4)
            this.buffer.push(this.lookAhead, this.pos, this.pos, -4);
    }
    updateContext(context) {
        if (context != this.curContext.context) {
            let newCx = new StackContext(this.curContext.tracker, context);
            if (newCx.hash != this.curContext.hash)
                this.emitContext();
            this.curContext = newCx;
        }
    }
    /**
    @internal
    */
    setLookAhead(lookAhead) {
        if (lookAhead > this.lookAhead) {
            this.emitLookAhead();
            this.lookAhead = lookAhead;
        }
    }
    /**
    @internal
    */
    close() {
        if (this.curContext && this.curContext.tracker.strict)
            this.emitContext();
        if (this.lookAhead > 0)
            this.emitLookAhead();
    }
}
class StackContext {
    constructor(tracker, context) {
        this.tracker = tracker;
        this.context = context;
        this.hash = tracker.strict ? tracker.hash(context) : 0;
    }
}
// Used to cheaply run some reductions to scan ahead without mutating
// an entire stack
class SimulatedStack {
    constructor(start) {
        this.start = start;
        this.state = start.state;
        this.stack = start.stack;
        this.base = this.stack.length;
    }
    reduce(action) {
        let term = action & 65535 /* Action.ValueMask */, depth = action >> 19 /* Action.ReduceDepthShift */;
        if (depth == 0) {
            if (this.stack == this.start.stack)
                this.stack = this.stack.slice();
            this.stack.push(this.state, 0, 0);
            this.base += 3;
        }
        else {
            this.base -= (depth - 1) * 3;
        }
        let goto = this.start.p.parser.getGoto(this.stack[this.base - 3], term, true);
        this.state = goto;
    }
}
// This is given to `Tree.build` to build a buffer, and encapsulates
// the parent-stack-walking necessary to read the nodes.
class StackBufferCursor {
    constructor(stack, pos, index) {
        this.stack = stack;
        this.pos = pos;
        this.index = index;
        this.buffer = stack.buffer;
        if (this.index == 0)
            this.maybeNext();
    }
    static create(stack, pos = stack.bufferBase + stack.buffer.length) {
        return new StackBufferCursor(stack, pos, pos - stack.bufferBase);
    }
    maybeNext() {
        let next = this.stack.parent;
        if (next != null) {
            this.index = this.stack.bufferBase - next.bufferBase;
            this.stack = next;
            this.buffer = next.buffer;
        }
    }
    get id() { return this.buffer[this.index - 4]; }
    get start() { return this.buffer[this.index - 3]; }
    get end() { return this.buffer[this.index - 2]; }
    get size() { return this.buffer[this.index - 1]; }
    next() {
        this.index -= 4;
        this.pos -= 4;
        if (this.index == 0)
            this.maybeNext();
    }
    fork() {
        return new StackBufferCursor(this.stack, this.pos, this.index);
    }
}

// See lezer-generator/src/encode.ts for comments about the encoding
// used here
function decodeArray(input, Type = Uint16Array) {
    if (typeof input != "string")
        return input;
    let array = null;
    for (let pos = 0, out = 0; pos < input.length;) {
        let value = 0;
        for (;;) {
            let next = input.charCodeAt(pos++), stop = false;
            if (next == 126 /* Encode.BigValCode */) {
                value = 65535 /* Encode.BigVal */;
                break;
            }
            if (next >= 92 /* Encode.Gap2 */)
                next--;
            if (next >= 34 /* Encode.Gap1 */)
                next--;
            let digit = next - 32 /* Encode.Start */;
            if (digit >= 46 /* Encode.Base */) {
                digit -= 46 /* Encode.Base */;
                stop = true;
            }
            value += digit;
            if (stop)
                break;
            value *= 46 /* Encode.Base */;
        }
        if (array)
            array[out++] = value;
        else
            array = new Type(value);
    }
    return array;
}

class CachedToken {
    constructor() {
        this.start = -1;
        this.value = -1;
        this.end = -1;
        this.extended = -1;
        this.lookAhead = 0;
        this.mask = 0;
        this.context = 0;
    }
}
const nullToken = new CachedToken;
/**
[Tokenizers](#lr.ExternalTokenizer) interact with the input
through this interface. It presents the input as a stream of
characters, tracking lookahead and hiding the complexity of
[ranges](#common.Parser.parse^ranges) from tokenizer code.
*/
class InputStream {
    /**
    @internal
    */
    constructor(
    /**
    @internal
    */
    input, 
    /**
    @internal
    */
    ranges) {
        this.input = input;
        this.ranges = ranges;
        /**
        @internal
        */
        this.chunk = "";
        /**
        @internal
        */
        this.chunkOff = 0;
        /**
        Backup chunk
        */
        this.chunk2 = "";
        this.chunk2Pos = 0;
        /**
        The character code of the next code unit in the input, or -1
        when the stream is at the end of the input.
        */
        this.next = -1;
        /**
        @internal
        */
        this.token = nullToken;
        this.rangeIndex = 0;
        this.pos = this.chunkPos = ranges[0].from;
        this.range = ranges[0];
        this.end = ranges[ranges.length - 1].to;
        this.readNext();
    }
    /**
    @internal
    */
    resolveOffset(offset, assoc) {
        let range = this.range, index = this.rangeIndex;
        let pos = this.pos + offset;
        while (pos < range.from) {
            if (!index)
                return null;
            let next = this.ranges[--index];
            pos -= range.from - next.to;
            range = next;
        }
        while (assoc < 0 ? pos > range.to : pos >= range.to) {
            if (index == this.ranges.length - 1)
                return null;
            let next = this.ranges[++index];
            pos += next.from - range.to;
            range = next;
        }
        return pos;
    }
    /**
    @internal
    */
    clipPos(pos) {
        if (pos >= this.range.from && pos < this.range.to)
            return pos;
        for (let range of this.ranges)
            if (range.to > pos)
                return Math.max(pos, range.from);
        return this.end;
    }
    /**
    Look at a code unit near the stream position. `.peek(0)` equals
    `.next`, `.peek(-1)` gives you the previous character, and so
    on.
    
    Note that looking around during tokenizing creates dependencies
    on potentially far-away content, which may reduce the
    effectiveness incremental parsing—when looking forward—or even
    cause invalid reparses when looking backward more than 25 code
    units, since the library does not track lookbehind.
    */
    peek(offset) {
        let idx = this.chunkOff + offset, pos, result;
        if (idx >= 0 && idx < this.chunk.length) {
            pos = this.pos + offset;
            result = this.chunk.charCodeAt(idx);
        }
        else {
            let resolved = this.resolveOffset(offset, 1);
            if (resolved == null)
                return -1;
            pos = resolved;
            if (pos >= this.chunk2Pos && pos < this.chunk2Pos + this.chunk2.length) {
                result = this.chunk2.charCodeAt(pos - this.chunk2Pos);
            }
            else {
                let i = this.rangeIndex, range = this.range;
                while (range.to <= pos)
                    range = this.ranges[++i];
                this.chunk2 = this.input.chunk(this.chunk2Pos = pos);
                if (pos + this.chunk2.length > range.to)
                    this.chunk2 = this.chunk2.slice(0, range.to - pos);
                result = this.chunk2.charCodeAt(0);
            }
        }
        if (pos >= this.token.lookAhead)
            this.token.lookAhead = pos + 1;
        return result;
    }
    /**
    Accept a token. By default, the end of the token is set to the
    current stream position, but you can pass an offset (relative to
    the stream position) to change that.
    */
    acceptToken(token, endOffset = 0) {
        let end = endOffset ? this.resolveOffset(endOffset, -1) : this.pos;
        if (end == null || end < this.token.start)
            throw new RangeError("Token end out of bounds");
        this.token.value = token;
        this.token.end = end;
    }
    /**
    Accept a token ending at a specific given position.
    */
    acceptTokenTo(token, endPos) {
        this.token.value = token;
        this.token.end = endPos;
    }
    getChunk() {
        if (this.pos >= this.chunk2Pos && this.pos < this.chunk2Pos + this.chunk2.length) {
            let { chunk, chunkPos } = this;
            this.chunk = this.chunk2;
            this.chunkPos = this.chunk2Pos;
            this.chunk2 = chunk;
            this.chunk2Pos = chunkPos;
            this.chunkOff = this.pos - this.chunkPos;
        }
        else {
            this.chunk2 = this.chunk;
            this.chunk2Pos = this.chunkPos;
            let nextChunk = this.input.chunk(this.pos);
            let end = this.pos + nextChunk.length;
            this.chunk = end > this.range.to ? nextChunk.slice(0, this.range.to - this.pos) : nextChunk;
            this.chunkPos = this.pos;
            this.chunkOff = 0;
        }
    }
    readNext() {
        if (this.chunkOff >= this.chunk.length) {
            this.getChunk();
            if (this.chunkOff == this.chunk.length)
                return this.next = -1;
        }
        return this.next = this.chunk.charCodeAt(this.chunkOff);
    }
    /**
    Move the stream forward N (defaults to 1) code units. Returns
    the new value of [`next`](#lr.InputStream.next).
    */
    advance(n = 1) {
        this.chunkOff += n;
        while (this.pos + n >= this.range.to) {
            if (this.rangeIndex == this.ranges.length - 1)
                return this.setDone();
            n -= this.range.to - this.pos;
            this.range = this.ranges[++this.rangeIndex];
            this.pos = this.range.from;
        }
        this.pos += n;
        if (this.pos >= this.token.lookAhead)
            this.token.lookAhead = this.pos + 1;
        return this.readNext();
    }
    setDone() {
        this.pos = this.chunkPos = this.end;
        this.range = this.ranges[this.rangeIndex = this.ranges.length - 1];
        this.chunk = "";
        return this.next = -1;
    }
    /**
    @internal
    */
    reset(pos, token) {
        if (token) {
            this.token = token;
            token.start = pos;
            token.lookAhead = pos + 1;
            token.value = token.extended = -1;
        }
        else {
            this.token = nullToken;
        }
        if (this.pos != pos) {
            this.pos = pos;
            if (pos == this.end) {
                this.setDone();
                return this;
            }
            while (pos < this.range.from)
                this.range = this.ranges[--this.rangeIndex];
            while (pos >= this.range.to)
                this.range = this.ranges[++this.rangeIndex];
            if (pos >= this.chunkPos && pos < this.chunkPos + this.chunk.length) {
                this.chunkOff = pos - this.chunkPos;
            }
            else {
                this.chunk = "";
                this.chunkOff = 0;
            }
            this.readNext();
        }
        return this;
    }
    /**
    @internal
    */
    read(from, to) {
        if (from >= this.chunkPos && to <= this.chunkPos + this.chunk.length)
            return this.chunk.slice(from - this.chunkPos, to - this.chunkPos);
        if (from >= this.chunk2Pos && to <= this.chunk2Pos + this.chunk2.length)
            return this.chunk2.slice(from - this.chunk2Pos, to - this.chunk2Pos);
        if (from >= this.range.from && to <= this.range.to)
            return this.input.read(from, to);
        let result = "";
        for (let r of this.ranges) {
            if (r.from >= to)
                break;
            if (r.to > from)
                result += this.input.read(Math.max(r.from, from), Math.min(r.to, to));
        }
        return result;
    }
}
/**
@internal
*/
class TokenGroup {
    constructor(data, id) {
        this.data = data;
        this.id = id;
    }
    token(input, stack) {
        let { parser } = stack.p;
        readToken(this.data, input, stack, this.id, parser.data, parser.tokenPrecTable);
    }
}
TokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
/**
@hide
*/
class LocalTokenGroup {
    constructor(data, precTable, elseToken) {
        this.precTable = precTable;
        this.elseToken = elseToken;
        this.data = typeof data == "string" ? decodeArray(data) : data;
    }
    token(input, stack) {
        let start = input.pos, skipped = 0;
        for (;;) {
            let atEof = input.next < 0, nextPos = input.resolveOffset(1, 1);
            readToken(this.data, input, stack, 0, this.data, this.precTable);
            if (input.token.value > -1)
                break;
            if (this.elseToken == null)
                return;
            if (!atEof)
                skipped++;
            if (nextPos == null)
                break;
            input.reset(nextPos, input.token);
        }
        if (skipped) {
            input.reset(start, input.token);
            input.acceptToken(this.elseToken, skipped);
        }
    }
}
LocalTokenGroup.prototype.contextual = TokenGroup.prototype.fallback = TokenGroup.prototype.extend = false;
/**
`@external tokens` declarations in the grammar should resolve to
an instance of this class.
*/
class ExternalTokenizer {
    /**
    Create a tokenizer. The first argument is the function that,
    given an input stream, scans for the types of tokens it
    recognizes at the stream's position, and calls
    [`acceptToken`](#lr.InputStream.acceptToken) when it finds
    one.
    */
    constructor(
    /**
    @internal
    */
    token, options = {}) {
        this.token = token;
        this.contextual = !!options.contextual;
        this.fallback = !!options.fallback;
        this.extend = !!options.extend;
    }
}
// Tokenizer data is stored a big uint16 array containing, for each
// state:
//
//  - A group bitmask, indicating what token groups are reachable from
//    this state, so that paths that can only lead to tokens not in
//    any of the current groups can be cut off early.
//
//  - The position of the end of the state's sequence of accepting
//    tokens
//
//  - The number of outgoing edges for the state
//
//  - The accepting tokens, as (token id, group mask) pairs
//
//  - The outgoing edges, as (start character, end character, state
//    index) triples, with end character being exclusive
//
// This function interprets that data, running through a stream as
// long as new states with the a matching group mask can be reached,
// and updating `input.token` when it matches a token.
function readToken(data, input, stack, group, precTable, precOffset) {
    let state = 0, groupMask = 1 << group, { dialect } = stack.p.parser;
    scan: for (;;) {
        if ((groupMask & data[state]) == 0)
            break;
        let accEnd = data[state + 1];
        // Check whether this state can lead to a token in the current group
        // Accept tokens in this state, possibly overwriting
        // lower-precedence / shorter tokens
        for (let i = state + 3; i < accEnd; i += 2)
            if ((data[i + 1] & groupMask) > 0) {
                let term = data[i];
                if (dialect.allows(term) &&
                    (input.token.value == -1 || input.token.value == term ||
                        overrides(term, input.token.value, precTable, precOffset))) {
                    input.acceptToken(term);
                    break;
                }
            }
        let next = input.next, low = 0, high = data[state + 2];
        // Special case for EOF
        if (input.next < 0 && high > low && data[accEnd + high * 3 - 3] == 65535 /* Seq.End */) {
            state = data[accEnd + high * 3 - 1];
            continue scan;
        }
        // Do a binary search on the state's edges
        for (; low < high;) {
            let mid = (low + high) >> 1;
            let index = accEnd + mid + (mid << 1);
            let from = data[index], to = data[index + 1] || 0x10000;
            if (next < from)
                high = mid;
            else if (next >= to)
                low = mid + 1;
            else {
                state = data[index + 2];
                input.advance();
                continue scan;
            }
        }
        break;
    }
}
function findOffset(data, start, term) {
    for (let i = start, next; (next = data[i]) != 65535 /* Seq.End */; i++)
        if (next == term)
            return i - start;
    return -1;
}
function overrides(token, prev, tableData, tableOffset) {
    let iPrev = findOffset(tableData, tableOffset, prev);
    return iPrev < 0 || findOffset(tableData, tableOffset, token) < iPrev;
}

// Environment variable used to control console output
const verbose = typeof process != "undefined" && process.env && /\bparse\b/.test(process.env.LOG);
let stackIDs = null;
function cutAt(tree, pos, side) {
    let cursor = tree.cursor(exports.IterMode.IncludeAnonymous);
    cursor.moveTo(pos);
    for (;;) {
        if (!(side < 0 ? cursor.childBefore(pos) : cursor.childAfter(pos)))
            for (;;) {
                if ((side < 0 ? cursor.to < pos : cursor.from > pos) && !cursor.type.isError)
                    return side < 0 ? Math.max(0, Math.min(cursor.to - 1, pos - 25 /* Lookahead.Margin */))
                        : Math.min(tree.length, Math.max(cursor.from + 1, pos + 25 /* Lookahead.Margin */));
                if (side < 0 ? cursor.prevSibling() : cursor.nextSibling())
                    break;
                if (!cursor.parent())
                    return side < 0 ? 0 : tree.length;
            }
    }
}
class FragmentCursor {
    constructor(fragments, nodeSet) {
        this.fragments = fragments;
        this.nodeSet = nodeSet;
        this.i = 0;
        this.fragment = null;
        this.safeFrom = -1;
        this.safeTo = -1;
        this.trees = [];
        this.start = [];
        this.index = [];
        this.nextFragment();
    }
    nextFragment() {
        let fr = this.fragment = this.i == this.fragments.length ? null : this.fragments[this.i++];
        if (fr) {
            this.safeFrom = fr.openStart ? cutAt(fr.tree, fr.from + fr.offset, 1) - fr.offset : fr.from;
            this.safeTo = fr.openEnd ? cutAt(fr.tree, fr.to + fr.offset, -1) - fr.offset : fr.to;
            while (this.trees.length) {
                this.trees.pop();
                this.start.pop();
                this.index.pop();
            }
            this.trees.push(fr.tree);
            this.start.push(-fr.offset);
            this.index.push(0);
            this.nextStart = this.safeFrom;
        }
        else {
            this.nextStart = 1e9;
        }
    }
    // `pos` must be >= any previously given `pos` for this cursor
    nodeAt(pos) {
        if (pos < this.nextStart)
            return null;
        while (this.fragment && this.safeTo <= pos)
            this.nextFragment();
        if (!this.fragment)
            return null;
        for (;;) {
            let last = this.trees.length - 1;
            if (last < 0) { // End of tree
                this.nextFragment();
                return null;
            }
            let top = this.trees[last], index = this.index[last];
            if (index == top.children.length) {
                this.trees.pop();
                this.start.pop();
                this.index.pop();
                continue;
            }
            let next = top.children[index];
            let start = this.start[last] + top.positions[index];
            if (start > pos) {
                this.nextStart = start;
                return null;
            }
            if (next instanceof Tree) {
                if (start == pos) {
                    if (start < this.safeFrom)
                        return null;
                    let end = start + next.length;
                    if (end <= this.safeTo) {
                        let lookAhead = next.prop(NodeProp.lookAhead);
                        if (!lookAhead || end + lookAhead < this.fragment.to)
                            return next;
                    }
                }
                this.index[last]++;
                if (start + next.length >= Math.max(this.safeFrom, pos)) { // Enter this node
                    this.trees.push(next);
                    this.start.push(start);
                    this.index.push(0);
                }
            }
            else {
                this.index[last]++;
                this.nextStart = start + next.length;
            }
        }
    }
}
class TokenCache {
    constructor(parser, stream) {
        this.stream = stream;
        this.tokens = [];
        this.mainToken = null;
        this.actions = [];
        this.tokens = parser.tokenizers.map(_ => new CachedToken);
    }
    getActions(stack) {
        let actionIndex = 0;
        let main = null;
        let { parser } = stack.p, { tokenizers } = parser;
        let mask = parser.stateSlot(stack.state, 3 /* ParseState.TokenizerMask */);
        let context = stack.curContext ? stack.curContext.hash : 0;
        let lookAhead = 0;
        for (let i = 0; i < tokenizers.length; i++) {
            if (((1 << i) & mask) == 0)
                continue;
            let tokenizer = tokenizers[i], token = this.tokens[i];
            if (main && !tokenizer.fallback)
                continue;
            if (tokenizer.contextual || token.start != stack.pos || token.mask != mask || token.context != context) {
                this.updateCachedToken(token, tokenizer, stack);
                token.mask = mask;
                token.context = context;
            }
            if (token.lookAhead > token.end + 25 /* Lookahead.Margin */)
                lookAhead = Math.max(token.lookAhead, lookAhead);
            if (token.value != 0 /* Term.Err */) {
                let startIndex = actionIndex;
                if (token.extended > -1)
                    actionIndex = this.addActions(stack, token.extended, token.end, actionIndex);
                actionIndex = this.addActions(stack, token.value, token.end, actionIndex);
                if (!tokenizer.extend) {
                    main = token;
                    if (actionIndex > startIndex)
                        break;
                }
            }
        }
        while (this.actions.length > actionIndex)
            this.actions.pop();
        if (lookAhead)
            stack.setLookAhead(lookAhead);
        if (!main && stack.pos == this.stream.end) {
            main = new CachedToken;
            main.value = stack.p.parser.eofTerm;
            main.start = main.end = stack.pos;
            actionIndex = this.addActions(stack, main.value, main.end, actionIndex);
        }
        this.mainToken = main;
        return this.actions;
    }
    getMainToken(stack) {
        if (this.mainToken)
            return this.mainToken;
        let main = new CachedToken, { pos, p } = stack;
        main.start = pos;
        main.end = Math.min(pos + 1, p.stream.end);
        main.value = pos == p.stream.end ? p.parser.eofTerm : 0 /* Term.Err */;
        return main;
    }
    updateCachedToken(token, tokenizer, stack) {
        let start = this.stream.clipPos(stack.pos);
        tokenizer.token(this.stream.reset(start, token), stack);
        if (token.value > -1) {
            let { parser } = stack.p;
            for (let i = 0; i < parser.specialized.length; i++)
                if (parser.specialized[i] == token.value) {
                    let result = parser.specializers[i](this.stream.read(token.start, token.end), stack);
                    if (result >= 0 && stack.p.parser.dialect.allows(result >> 1)) {
                        if ((result & 1) == 0 /* Specialize.Specialize */)
                            token.value = result >> 1;
                        else
                            token.extended = result >> 1;
                        break;
                    }
                }
        }
        else {
            token.value = 0 /* Term.Err */;
            token.end = this.stream.clipPos(start + 1);
        }
    }
    putAction(action, token, end, index) {
        // Don't add duplicate actions
        for (let i = 0; i < index; i += 3)
            if (this.actions[i] == action)
                return index;
        this.actions[index++] = action;
        this.actions[index++] = token;
        this.actions[index++] = end;
        return index;
    }
    addActions(stack, token, end, index) {
        let { state } = stack, { parser } = stack.p, { data } = parser;
        for (let set = 0; set < 2; set++) {
            for (let i = parser.stateSlot(state, set ? 2 /* ParseState.Skip */ : 1 /* ParseState.Actions */);; i += 3) {
                if (data[i] == 65535 /* Seq.End */) {
                    if (data[i + 1] == 1 /* Seq.Next */) {
                        i = pair(data, i + 2);
                    }
                    else {
                        if (index == 0 && data[i + 1] == 2 /* Seq.Other */)
                            index = this.putAction(pair(data, i + 2), token, end, index);
                        break;
                    }
                }
                if (data[i] == token)
                    index = this.putAction(pair(data, i + 1), token, end, index);
            }
        }
        return index;
    }
}
class Parse {
    constructor(parser, input, fragments, ranges) {
        this.parser = parser;
        this.input = input;
        this.ranges = ranges;
        this.recovering = 0;
        this.nextStackID = 0x2654; // ♔, ♕, ♖, ♗, ♘, ♙, ♠, ♡, ♢, ♣, ♤, ♥, ♦, ♧
        this.minStackPos = 0;
        this.reused = [];
        this.stoppedAt = null;
        this.lastBigReductionStart = -1;
        this.lastBigReductionSize = 0;
        this.bigReductionCount = 0;
        this.stream = new InputStream(input, ranges);
        this.tokens = new TokenCache(parser, this.stream);
        this.topTerm = parser.top[1];
        let { from } = ranges[0];
        this.stacks = [Stack.start(this, parser.top[0], from)];
        this.fragments = fragments.length && this.stream.end - from > parser.bufferLength * 4
            ? new FragmentCursor(fragments, parser.nodeSet) : null;
    }
    get parsedPos() {
        return this.minStackPos;
    }
    // Move the parser forward. This will process all parse stacks at
    // `this.pos` and try to advance them to a further position. If no
    // stack for such a position is found, it'll start error-recovery.
    //
    // When the parse is finished, this will return a syntax tree. When
    // not, it returns `null`.
    advance() {
        let stacks = this.stacks, pos = this.minStackPos;
        // This will hold stacks beyond `pos`.
        let newStacks = this.stacks = [];
        let stopped, stoppedTokens;
        // If a large amount of reductions happened with the same start
        // position, force the stack out of that production in order to
        // avoid creating a tree too deep to recurse through.
        // (This is an ugly kludge, because unfortunately there is no
        // straightforward, cheap way to check for this happening, due to
        // the history of reductions only being available in an
        // expensive-to-access format in the stack buffers.)
        if (this.bigReductionCount > 300 /* Rec.MaxLeftAssociativeReductionCount */ && stacks.length == 1) {
            let [s] = stacks;
            while (s.forceReduce() && s.stack.length && s.stack[s.stack.length - 2] >= this.lastBigReductionStart) { }
            this.bigReductionCount = this.lastBigReductionSize = 0;
        }
        // Keep advancing any stacks at `pos` until they either move
        // forward or can't be advanced. Gather stacks that can't be
        // advanced further in `stopped`.
        for (let i = 0; i < stacks.length; i++) {
            let stack = stacks[i];
            for (;;) {
                this.tokens.mainToken = null;
                if (stack.pos > pos) {
                    newStacks.push(stack);
                }
                else if (this.advanceStack(stack, newStacks, stacks)) {
                    continue;
                }
                else {
                    if (!stopped) {
                        stopped = [];
                        stoppedTokens = [];
                    }
                    stopped.push(stack);
                    let tok = this.tokens.getMainToken(stack);
                    stoppedTokens.push(tok.value, tok.end);
                }
                break;
            }
        }
        if (!newStacks.length) {
            let finished = stopped && findFinished(stopped);
            if (finished) {
                if (verbose)
                    console.log("Finish with " + this.stackID(finished));
                return this.stackToTree(finished);
            }
            if (this.parser.strict) {
                if (verbose && stopped)
                    console.log("Stuck with token " + (this.tokens.mainToken ? this.parser.getName(this.tokens.mainToken.value) : "none"));
                throw new SyntaxError("No parse at " + pos);
            }
            if (!this.recovering)
                this.recovering = 5 /* Rec.Distance */;
        }
        if (this.recovering && stopped) {
            let finished = this.stoppedAt != null && stopped[0].pos > this.stoppedAt ? stopped[0]
                : this.runRecovery(stopped, stoppedTokens, newStacks);
            if (finished) {
                if (verbose)
                    console.log("Force-finish " + this.stackID(finished));
                return this.stackToTree(finished.forceAll());
            }
        }
        if (this.recovering) {
            let maxRemaining = this.recovering == 1 ? 1 : this.recovering * 3 /* Rec.MaxRemainingPerStep */;
            if (newStacks.length > maxRemaining) {
                newStacks.sort((a, b) => b.score - a.score);
                while (newStacks.length > maxRemaining)
                    newStacks.pop();
            }
            if (newStacks.some(s => s.reducePos > pos))
                this.recovering--;
        }
        else if (newStacks.length > 1) {
            // Prune stacks that are in the same state, or that have been
            // running without splitting for a while, to avoid getting stuck
            // with multiple successful stacks running endlessly on.
            outer: for (let i = 0; i < newStacks.length - 1; i++) {
                let stack = newStacks[i];
                for (let j = i + 1; j < newStacks.length; j++) {
                    let other = newStacks[j];
                    if (stack.sameState(other) ||
                        stack.buffer.length > 500 /* Rec.MinBufferLengthPrune */ && other.buffer.length > 500 /* Rec.MinBufferLengthPrune */) {
                        if (((stack.score - other.score) || (stack.buffer.length - other.buffer.length)) > 0) {
                            newStacks.splice(j--, 1);
                        }
                        else {
                            newStacks.splice(i--, 1);
                            continue outer;
                        }
                    }
                }
            }
            if (newStacks.length > 12 /* Rec.MaxStackCount */)
                newStacks.splice(12 /* Rec.MaxStackCount */, newStacks.length - 12 /* Rec.MaxStackCount */);
        }
        this.minStackPos = newStacks[0].pos;
        for (let i = 1; i < newStacks.length; i++)
            if (newStacks[i].pos < this.minStackPos)
                this.minStackPos = newStacks[i].pos;
        return null;
    }
    stopAt(pos) {
        if (this.stoppedAt != null && this.stoppedAt < pos)
            throw new RangeError("Can't move stoppedAt forward");
        this.stoppedAt = pos;
    }
    // Returns an updated version of the given stack, or null if the
    // stack can't advance normally. When `split` and `stacks` are
    // given, stacks split off by ambiguous operations will be pushed to
    // `split`, or added to `stacks` if they move `pos` forward.
    advanceStack(stack, stacks, split) {
        let start = stack.pos, { parser } = this;
        let base = verbose ? this.stackID(stack) + " -> " : "";
        if (this.stoppedAt != null && start > this.stoppedAt)
            return stack.forceReduce() ? stack : null;
        if (this.fragments) {
            let strictCx = stack.curContext && stack.curContext.tracker.strict, cxHash = strictCx ? stack.curContext.hash : 0;
            for (let cached = this.fragments.nodeAt(start); cached;) {
                let match = this.parser.nodeSet.types[cached.type.id] == cached.type ? parser.getGoto(stack.state, cached.type.id) : -1;
                if (match > -1 && cached.length && (!strictCx || (cached.prop(NodeProp.contextHash) || 0) == cxHash)) {
                    stack.useNode(cached, match);
                    if (verbose)
                        console.log(base + this.stackID(stack) + ` (via reuse of ${parser.getName(cached.type.id)})`);
                    return true;
                }
                if (!(cached instanceof Tree) || cached.children.length == 0 || cached.positions[0] > 0)
                    break;
                let inner = cached.children[0];
                if (inner instanceof Tree && cached.positions[0] == 0)
                    cached = inner;
                else
                    break;
            }
        }
        let defaultReduce = parser.stateSlot(stack.state, 4 /* ParseState.DefaultReduce */);
        if (defaultReduce > 0) {
            stack.reduce(defaultReduce);
            if (verbose)
                console.log(base + this.stackID(stack) + ` (via always-reduce ${parser.getName(defaultReduce & 65535 /* Action.ValueMask */)})`);
            return true;
        }
        if (stack.stack.length >= 8400 /* Rec.CutDepth */) {
            while (stack.stack.length > 6000 /* Rec.CutTo */ && stack.forceReduce()) { }
        }
        let actions = this.tokens.getActions(stack);
        for (let i = 0; i < actions.length;) {
            let action = actions[i++], term = actions[i++], end = actions[i++];
            let last = i == actions.length || !split;
            let localStack = last ? stack : stack.split();
            let main = this.tokens.mainToken;
            localStack.apply(action, term, main ? main.start : localStack.pos, end);
            if (verbose)
                console.log(base + this.stackID(localStack) + ` (via ${(action & 65536 /* Action.ReduceFlag */) == 0 ? "shift"
                    : `reduce of ${parser.getName(action & 65535 /* Action.ValueMask */)}`} for ${parser.getName(term)} @ ${start}${localStack == stack ? "" : ", split"})`);
            if (last)
                return true;
            else if (localStack.pos > start)
                stacks.push(localStack);
            else
                split.push(localStack);
        }
        return false;
    }
    // Advance a given stack forward as far as it will go. Returns the
    // (possibly updated) stack if it got stuck, or null if it moved
    // forward and was given to `pushStackDedup`.
    advanceFully(stack, newStacks) {
        let pos = stack.pos;
        for (;;) {
            if (!this.advanceStack(stack, null, null))
                return false;
            if (stack.pos > pos) {
                pushStackDedup(stack, newStacks);
                return true;
            }
        }
    }
    runRecovery(stacks, tokens, newStacks) {
        let finished = null, restarted = false;
        for (let i = 0; i < stacks.length; i++) {
            let stack = stacks[i], token = tokens[i << 1], tokenEnd = tokens[(i << 1) + 1];
            let base = verbose ? this.stackID(stack) + " -> " : "";
            if (stack.deadEnd) {
                if (restarted)
                    continue;
                restarted = true;
                stack.restart();
                if (verbose)
                    console.log(base + this.stackID(stack) + " (restarted)");
                let done = this.advanceFully(stack, newStacks);
                if (done)
                    continue;
            }
            let force = stack.split(), forceBase = base;
            for (let j = 0; force.forceReduce() && j < 10 /* Rec.ForceReduceLimit */; j++) {
                if (verbose)
                    console.log(forceBase + this.stackID(force) + " (via force-reduce)");
                let done = this.advanceFully(force, newStacks);
                if (done)
                    break;
                if (verbose)
                    forceBase = this.stackID(force) + " -> ";
            }
            for (let insert of stack.recoverByInsert(token)) {
                if (verbose)
                    console.log(base + this.stackID(insert) + " (via recover-insert)");
                this.advanceFully(insert, newStacks);
            }
            if (this.stream.end > stack.pos) {
                if (tokenEnd == stack.pos) {
                    tokenEnd++;
                    token = 0 /* Term.Err */;
                }
                stack.recoverByDelete(token, tokenEnd);
                if (verbose)
                    console.log(base + this.stackID(stack) + ` (via recover-delete ${this.parser.getName(token)})`);
                pushStackDedup(stack, newStacks);
            }
            else if (!finished || finished.score < stack.score) {
                finished = stack;
            }
        }
        return finished;
    }
    // Convert the stack's buffer to a syntax tree.
    stackToTree(stack) {
        stack.close();
        return Tree.build({ buffer: StackBufferCursor.create(stack),
            nodeSet: this.parser.nodeSet,
            topID: this.topTerm,
            maxBufferLength: this.parser.bufferLength,
            reused: this.reused,
            start: this.ranges[0].from,
            length: stack.pos - this.ranges[0].from,
            minRepeatType: this.parser.minRepeatTerm });
    }
    stackID(stack) {
        let id = (stackIDs || (stackIDs = new WeakMap)).get(stack);
        if (!id)
            stackIDs.set(stack, id = String.fromCodePoint(this.nextStackID++));
        return id + stack;
    }
}
function pushStackDedup(stack, newStacks) {
    for (let i = 0; i < newStacks.length; i++) {
        let other = newStacks[i];
        if (other.pos == stack.pos && other.sameState(stack)) {
            if (newStacks[i].score < stack.score)
                newStacks[i] = stack;
            return;
        }
    }
    newStacks.push(stack);
}
class Dialect {
    constructor(source, flags, disabled) {
        this.source = source;
        this.flags = flags;
        this.disabled = disabled;
    }
    allows(term) { return !this.disabled || this.disabled[term] == 0; }
}
const id = x => x;
/**
Context trackers are used to track stateful context (such as
indentation in the Python grammar, or parent elements in the XML
grammar) needed by external tokenizers. You declare them in a
grammar file as `@context exportName from "module"`.

Context values should be immutable, and can be updated (replaced)
on shift or reduce actions.

The export used in a `@context` declaration should be of this
type.
*/
class ContextTracker {
    /**
    Define a context tracker.
    */
    constructor(spec) {
        this.start = spec.start;
        this.shift = spec.shift || id;
        this.reduce = spec.reduce || id;
        this.reuse = spec.reuse || id;
        this.hash = spec.hash || (() => 0);
        this.strict = spec.strict !== false;
    }
}
/**
Holds the parse tables for a given grammar, as generated by
`lezer-generator`, and provides [methods](#common.Parser) to parse
content with.
*/
class LRParser extends Parser {
    /**
    @internal
    */
    constructor(spec) {
        super();
        /**
        @internal
        */
        this.wrappers = [];
        if (spec.version != 14 /* File.Version */)
            throw new RangeError(`Parser version (${spec.version}) doesn't match runtime version (${14 /* File.Version */})`);
        let nodeNames = spec.nodeNames.split(" ");
        this.minRepeatTerm = nodeNames.length;
        for (let i = 0; i < spec.repeatNodeCount; i++)
            nodeNames.push("");
        let topTerms = Object.keys(spec.topRules).map(r => spec.topRules[r][1]);
        let nodeProps = [];
        for (let i = 0; i < nodeNames.length; i++)
            nodeProps.push([]);
        function setProp(nodeID, prop, value) {
            nodeProps[nodeID].push([prop, prop.deserialize(String(value))]);
        }
        if (spec.nodeProps)
            for (let propSpec of spec.nodeProps) {
                let prop = propSpec[0];
                if (typeof prop == "string")
                    prop = NodeProp[prop];
                for (let i = 1; i < propSpec.length;) {
                    let next = propSpec[i++];
                    if (next >= 0) {
                        setProp(next, prop, propSpec[i++]);
                    }
                    else {
                        let value = propSpec[i + -next];
                        for (let j = -next; j > 0; j--)
                            setProp(propSpec[i++], prop, value);
                        i++;
                    }
                }
            }
        this.nodeSet = new NodeSet(nodeNames.map((name, i) => NodeType.define({
            name: i >= this.minRepeatTerm ? undefined : name,
            id: i,
            props: nodeProps[i],
            top: topTerms.indexOf(i) > -1,
            error: i == 0,
            skipped: spec.skippedNodes && spec.skippedNodes.indexOf(i) > -1
        })));
        if (spec.propSources)
            this.nodeSet = this.nodeSet.extend(...spec.propSources);
        this.strict = false;
        this.bufferLength = DefaultBufferLength;
        let tokenArray = decodeArray(spec.tokenData);
        this.context = spec.context;
        this.specializerSpecs = spec.specialized || [];
        this.specialized = new Uint16Array(this.specializerSpecs.length);
        for (let i = 0; i < this.specializerSpecs.length; i++)
            this.specialized[i] = this.specializerSpecs[i].term;
        this.specializers = this.specializerSpecs.map(getSpecializer);
        this.states = decodeArray(spec.states, Uint32Array);
        this.data = decodeArray(spec.stateData);
        this.goto = decodeArray(spec.goto);
        this.maxTerm = spec.maxTerm;
        this.tokenizers = spec.tokenizers.map(value => typeof value == "number" ? new TokenGroup(tokenArray, value) : value);
        this.topRules = spec.topRules;
        this.dialects = spec.dialects || {};
        this.dynamicPrecedences = spec.dynamicPrecedences || null;
        this.tokenPrecTable = spec.tokenPrec;
        this.termNames = spec.termNames || null;
        this.maxNode = this.nodeSet.types.length - 1;
        this.dialect = this.parseDialect();
        this.top = this.topRules[Object.keys(this.topRules)[0]];
    }
    createParse(input, fragments, ranges) {
        let parse = new Parse(this, input, fragments, ranges);
        for (let w of this.wrappers)
            parse = w(parse, input, fragments, ranges);
        return parse;
    }
    /**
    Get a goto table entry @internal
    */
    getGoto(state, term, loose = false) {
        let table = this.goto;
        if (term >= table[0])
            return -1;
        for (let pos = table[term + 1];;) {
            let groupTag = table[pos++], last = groupTag & 1;
            let target = table[pos++];
            if (last && loose)
                return target;
            for (let end = pos + (groupTag >> 1); pos < end; pos++)
                if (table[pos] == state)
                    return target;
            if (last)
                return -1;
        }
    }
    /**
    Check if this state has an action for a given terminal @internal
    */
    hasAction(state, terminal) {
        let data = this.data;
        for (let set = 0; set < 2; set++) {
            for (let i = this.stateSlot(state, set ? 2 /* ParseState.Skip */ : 1 /* ParseState.Actions */), next;; i += 3) {
                if ((next = data[i]) == 65535 /* Seq.End */) {
                    if (data[i + 1] == 1 /* Seq.Next */)
                        next = data[i = pair(data, i + 2)];
                    else if (data[i + 1] == 2 /* Seq.Other */)
                        return pair(data, i + 2);
                    else
                        break;
                }
                if (next == terminal || next == 0 /* Term.Err */)
                    return pair(data, i + 1);
            }
        }
        return 0;
    }
    /**
    @internal
    */
    stateSlot(state, slot) {
        return this.states[(state * 6 /* ParseState.Size */) + slot];
    }
    /**
    @internal
    */
    stateFlag(state, flag) {
        return (this.stateSlot(state, 0 /* ParseState.Flags */) & flag) > 0;
    }
    /**
    @internal
    */
    validAction(state, action) {
        return !!this.allActions(state, a => a == action ? true : null);
    }
    /**
    @internal
    */
    allActions(state, action) {
        let deflt = this.stateSlot(state, 4 /* ParseState.DefaultReduce */);
        let result = deflt ? action(deflt) : undefined;
        for (let i = this.stateSlot(state, 1 /* ParseState.Actions */); result == null; i += 3) {
            if (this.data[i] == 65535 /* Seq.End */) {
                if (this.data[i + 1] == 1 /* Seq.Next */)
                    i = pair(this.data, i + 2);
                else
                    break;
            }
            result = action(pair(this.data, i + 1));
        }
        return result;
    }
    /**
    Get the states that can follow this one through shift actions or
    goto jumps. @internal
    */
    nextStates(state) {
        let result = [];
        for (let i = this.stateSlot(state, 1 /* ParseState.Actions */);; i += 3) {
            if (this.data[i] == 65535 /* Seq.End */) {
                if (this.data[i + 1] == 1 /* Seq.Next */)
                    i = pair(this.data, i + 2);
                else
                    break;
            }
            if ((this.data[i + 2] & (65536 /* Action.ReduceFlag */ >> 16)) == 0) {
                let value = this.data[i + 1];
                if (!result.some((v, i) => (i & 1) && v == value))
                    result.push(this.data[i], value);
            }
        }
        return result;
    }
    /**
    Configure the parser. Returns a new parser instance that has the
    given settings modified. Settings not provided in `config` are
    kept from the original parser.
    */
    configure(config) {
        // Hideous reflection-based kludge to make it easy to create a
        // slightly modified copy of a parser.
        let copy = Object.assign(Object.create(LRParser.prototype), this);
        if (config.props)
            copy.nodeSet = this.nodeSet.extend(...config.props);
        if (config.top) {
            let info = this.topRules[config.top];
            if (!info)
                throw new RangeError(`Invalid top rule name ${config.top}`);
            copy.top = info;
        }
        if (config.tokenizers)
            copy.tokenizers = this.tokenizers.map(t => {
                let found = config.tokenizers.find(r => r.from == t);
                return found ? found.to : t;
            });
        if (config.specializers) {
            copy.specializers = this.specializers.slice();
            copy.specializerSpecs = this.specializerSpecs.map((s, i) => {
                let found = config.specializers.find(r => r.from == s.external);
                if (!found)
                    return s;
                let spec = Object.assign(Object.assign({}, s), { external: found.to });
                copy.specializers[i] = getSpecializer(spec);
                return spec;
            });
        }
        if (config.contextTracker)
            copy.context = config.contextTracker;
        if (config.dialect)
            copy.dialect = this.parseDialect(config.dialect);
        if (config.strict != null)
            copy.strict = config.strict;
        if (config.wrap)
            copy.wrappers = copy.wrappers.concat(config.wrap);
        if (config.bufferLength != null)
            copy.bufferLength = config.bufferLength;
        return copy;
    }
    /**
    Tells you whether any [parse wrappers](#lr.ParserConfig.wrap)
    are registered for this parser.
    */
    hasWrappers() {
        return this.wrappers.length > 0;
    }
    /**
    Returns the name associated with a given term. This will only
    work for all terms when the parser was generated with the
    `--names` option. By default, only the names of tagged terms are
    stored.
    */
    getName(term) {
        return this.termNames ? this.termNames[term] : String(term <= this.maxNode && this.nodeSet.types[term].name || term);
    }
    /**
    The eof term id is always allocated directly after the node
    types. @internal
    */
    get eofTerm() { return this.maxNode + 1; }
    /**
    The type of top node produced by the parser.
    */
    get topNode() { return this.nodeSet.types[this.top[1]]; }
    /**
    @internal
    */
    dynamicPrecedence(term) {
        let prec = this.dynamicPrecedences;
        return prec == null ? 0 : prec[term] || 0;
    }
    /**
    @internal
    */
    parseDialect(dialect) {
        let values = Object.keys(this.dialects), flags = values.map(() => false);
        if (dialect)
            for (let part of dialect.split(" ")) {
                let id = values.indexOf(part);
                if (id >= 0)
                    flags[id] = true;
            }
        let disabled = null;
        for (let i = 0; i < values.length; i++)
            if (!flags[i]) {
                for (let j = this.dialects[values[i]], id; (id = this.data[j++]) != 65535 /* Seq.End */;)
                    (disabled || (disabled = new Uint8Array(this.maxTerm + 1)))[id] = 1;
            }
        return new Dialect(dialect, flags, disabled);
    }
    /**
    Used by the output of the parser generator. Not available to
    user code. @hide
    */
    static deserialize(spec) {
        return new LRParser(spec);
    }
}
function pair(data, off) { return data[off] | (data[off + 1] << 16); }
function findFinished(stacks) {
    let best = null;
    for (let stack of stacks) {
        let stopped = stack.p.stoppedAt;
        if ((stack.pos == stack.p.stream.end || stopped != null && stack.pos > stopped) &&
            stack.p.parser.stateFlag(stack.state, 2 /* StateFlag.Accepting */) &&
            (!best || best.score < stack.score))
            best = stack;
    }
    return best;
}
function getSpecializer(spec) {
    if (spec.external) {
        let mask = spec.extend ? 1 /* Specialize.Extend */ : 0 /* Specialize.Specialize */;
        return (value, stack) => (spec.external(value, stack) << 1) | mask;
    }
    return spec.get;
}

// This file was generated by lezer-generator. You probably shouldn't edit it.
const noSemi = 314,
  noSemiType = 315,
  incdec = 1,
  incdecPrefix = 2,
  questionDot = 3,
  JSXStartTag = 4,
  insertSemi = 316,
  spaces = 318,
  newline$1 = 319,
  LineComment = 5,
  BlockComment = 6,
  Dialect_jsx = 0;

/* Hand-written tokenizers for JavaScript tokens that can't be
   expressed by lezer's built-in tokenizer. */

const space$1 = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200,
               8201, 8202, 8232, 8233, 8239, 8287, 12288];

const braceR = 125, semicolon = 59, slash$1 = 47, star = 42, plus = 43, minus = 45, lt = 60, comma = 44,
      question$1 = 63, dot = 46, bracketL$1 = 91;

const trackNewline = new ContextTracker({
  start: false,
  shift(context, term) {
    return term == LineComment || term == BlockComment || term == spaces ? context : term == newline$1
  },
  strict: false
});

const insertSemicolon = new ExternalTokenizer((input, stack) => {
  let {next} = input;
  if (next == braceR || next == -1 || stack.context)
    input.acceptToken(insertSemi);
}, {contextual: true, fallback: true});

const noSemicolon = new ExternalTokenizer((input, stack) => {
  let {next} = input, after;
  if (space$1.indexOf(next) > -1) return
  if (next == slash$1 && ((after = input.peek(1)) == slash$1 || after == star)) return
  if (next != braceR && next != semicolon && next != -1 && !stack.context)
    input.acceptToken(noSemi);
}, {contextual: true});

const noSemicolonType = new ExternalTokenizer((input, stack) => {
  if (input.next == bracketL$1 && !stack.context) input.acceptToken(noSemiType);
}, {contextual: true});

const operatorToken = new ExternalTokenizer((input, stack) => {
  let {next} = input;
  if (next == plus || next == minus) {
    input.advance();
    if (next == input.next) {
      input.advance();
      let mayPostfix = !stack.context && stack.canShift(incdec);
      input.acceptToken(mayPostfix ? incdec : incdecPrefix);
    }
  } else if (next == question$1 && input.peek(1) == dot) {
    input.advance(); input.advance();
    if (input.next < 48 || input.next > 57) // No digit after
      input.acceptToken(questionDot);
  }
}, {contextual: true});

function identifierChar(ch, start) {
  return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch == 95 || ch >= 192 ||
    !start && ch >= 48 && ch <= 57
}

const jsx = new ExternalTokenizer((input, stack) => {
  if (input.next != lt || !stack.dialectEnabled(Dialect_jsx)) return
  input.advance();
  if (input.next == slash$1) return
  // Scan for an identifier followed by a comma or 'extends', don't
  // treat this as a start tag if present.
  let back = 0;
  while (space$1.indexOf(input.next) > -1) { input.advance(); back++; }
  if (identifierChar(input.next, true)) {
    input.advance();
    back++;
    while (identifierChar(input.next, false)) { input.advance(); back++; }
    while (space$1.indexOf(input.next) > -1) { input.advance(); back++; }
    if (input.next == comma) return
    for (let i = 0;; i++) {
      if (i == 7) {
        if (!identifierChar(input.next, true)) return
        break
      }
      if (input.next != "extends".charCodeAt(i)) break
      input.advance();
      back++;
    }
  }
  input.acceptToken(JSXStartTag, -back);
});

const jsHighlight = ext_CodeMirror_v6_lib.styleTags({
  "get set async static": ext_CodeMirror_v6_lib.tags.modifier,
  "for while do if else switch try catch finally return throw break continue default case": ext_CodeMirror_v6_lib.tags.controlKeyword,
  "in of await yield void typeof delete instanceof": ext_CodeMirror_v6_lib.tags.operatorKeyword,
  "let var const using function class extends": ext_CodeMirror_v6_lib.tags.definitionKeyword,
  "import export from": ext_CodeMirror_v6_lib.tags.moduleKeyword,
  "with debugger as new": ext_CodeMirror_v6_lib.tags.keyword,
  TemplateString: ext_CodeMirror_v6_lib.tags.special(ext_CodeMirror_v6_lib.tags.string),
  super: ext_CodeMirror_v6_lib.tags.atom,
  BooleanLiteral: ext_CodeMirror_v6_lib.tags.bool,
  this: ext_CodeMirror_v6_lib.tags.self,
  null: ext_CodeMirror_v6_lib.tags.null,
  Star: ext_CodeMirror_v6_lib.tags.modifier,
  VariableName: ext_CodeMirror_v6_lib.tags.variableName,
  "CallExpression/VariableName TaggedTemplateExpression/VariableName": ext_CodeMirror_v6_lib.tags.function(ext_CodeMirror_v6_lib.tags.variableName),
  VariableDefinition: ext_CodeMirror_v6_lib.tags.definition(ext_CodeMirror_v6_lib.tags.variableName),
  Label: ext_CodeMirror_v6_lib.tags.labelName,
  PropertyName: ext_CodeMirror_v6_lib.tags.propertyName,
  PrivatePropertyName: ext_CodeMirror_v6_lib.tags.special(ext_CodeMirror_v6_lib.tags.propertyName),
  "CallExpression/MemberExpression/PropertyName": ext_CodeMirror_v6_lib.tags.function(ext_CodeMirror_v6_lib.tags.propertyName),
  "FunctionDeclaration/VariableDefinition": ext_CodeMirror_v6_lib.tags.function(ext_CodeMirror_v6_lib.tags.definition(ext_CodeMirror_v6_lib.tags.variableName)),
  "ClassDeclaration/VariableDefinition": ext_CodeMirror_v6_lib.tags.definition(ext_CodeMirror_v6_lib.tags.className),
  "NewExpression/VariableName": ext_CodeMirror_v6_lib.tags.className,
  PropertyDefinition: ext_CodeMirror_v6_lib.tags.definition(ext_CodeMirror_v6_lib.tags.propertyName),
  PrivatePropertyDefinition: ext_CodeMirror_v6_lib.tags.definition(ext_CodeMirror_v6_lib.tags.special(ext_CodeMirror_v6_lib.tags.propertyName)),
  UpdateOp: ext_CodeMirror_v6_lib.tags.updateOperator,
  "LineComment Hashbang": ext_CodeMirror_v6_lib.tags.lineComment,
  BlockComment: ext_CodeMirror_v6_lib.tags.blockComment,
  Number: ext_CodeMirror_v6_lib.tags.number,
  String: ext_CodeMirror_v6_lib.tags.string,
  Escape: ext_CodeMirror_v6_lib.tags.escape,
  ArithOp: ext_CodeMirror_v6_lib.tags.arithmeticOperator,
  LogicOp: ext_CodeMirror_v6_lib.tags.logicOperator,
  BitOp: ext_CodeMirror_v6_lib.tags.bitwiseOperator,
  CompareOp: ext_CodeMirror_v6_lib.tags.compareOperator,
  RegExp: ext_CodeMirror_v6_lib.tags.regexp,
  Equals: ext_CodeMirror_v6_lib.tags.definitionOperator,
  Arrow: ext_CodeMirror_v6_lib.tags.function(ext_CodeMirror_v6_lib.tags.punctuation),
  ": Spread": ext_CodeMirror_v6_lib.tags.punctuation,
  "( )": ext_CodeMirror_v6_lib.tags.paren,
  "[ ]": ext_CodeMirror_v6_lib.tags.squareBracket,
  "{ }": ext_CodeMirror_v6_lib.tags.brace,
  "InterpolationStart InterpolationEnd": ext_CodeMirror_v6_lib.tags.special(ext_CodeMirror_v6_lib.tags.brace),
  ".": ext_CodeMirror_v6_lib.tags.derefOperator,
  ", ;": ext_CodeMirror_v6_lib.tags.separator,
  "@": ext_CodeMirror_v6_lib.tags.meta,

  TypeName: ext_CodeMirror_v6_lib.tags.typeName,
  TypeDefinition: ext_CodeMirror_v6_lib.tags.definition(ext_CodeMirror_v6_lib.tags.typeName),
  "type enum interface implements namespace module declare": ext_CodeMirror_v6_lib.tags.definitionKeyword,
  "abstract global Privacy readonly override": ext_CodeMirror_v6_lib.tags.modifier,
  "is keyof unique infer asserts": ext_CodeMirror_v6_lib.tags.operatorKeyword,

  JSXAttributeValue: ext_CodeMirror_v6_lib.tags.attributeValue,
  JSXText: ext_CodeMirror_v6_lib.tags.content,
  "JSXStartTag JSXStartCloseTag JSXSelfCloseEndTag JSXEndTag": ext_CodeMirror_v6_lib.tags.angleBracket,
  "JSXIdentifier JSXNameSpacedName": ext_CodeMirror_v6_lib.tags.tagName,
  "JSXAttribute/JSXIdentifier JSXAttribute/JSXNameSpacedName": ext_CodeMirror_v6_lib.tags.attributeName,
  "JSXBuiltin/JSXIdentifier": ext_CodeMirror_v6_lib.tags.standard(ext_CodeMirror_v6_lib.tags.tagName)
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const spec_identifier$1 = {__proto__:null,export:20, as:25, from:33, default:36, async:41, function:42, const:52, extends:56, this:60, true:68, false:68, null:80, void:84, typeof:88, super:104, new:138, delete:150, yield:159, await:163, class:168, public:231, private:231, protected:231, readonly:233, instanceof:252, satisfies:255, in:256, import:290, keyof:347, unique:351, infer:357, asserts:393, is:395, abstract:415, implements:417, type:419, let:422, var:424, using:427, interface:433, enum:437, namespace:443, module:445, declare:449, global:453, for:472, of:481, while:484, with:488, do:492, if:496, else:498, switch:502, case:508, try:514, catch:518, finally:522, return:526, throw:530, break:534, continue:538, debugger:542};
const spec_word = {__proto__:null,async:125, get:127, set:129, declare:191, public:193, private:193, protected:193, static:195, abstract:197, override:199, readonly:205, accessor:207, new:399};
const spec_LessThan = {__proto__:null,"<":189};
const parser$4 = LRParser.deserialize({
  version: 14,
  states: "$EOQ%TQlOOO%[QlOOO'_QpOOP(lO`OOO*zQ!0MxO'#CiO+RO#tO'#CjO+aO&jO'#CjO+oO#@ItO'#D_O.QQlO'#DeO.bQlO'#DpO%[QlO'#DxO0fQlO'#EQOOQ!0Lf'#EY'#EYO1PQ`O'#EVOOQO'#En'#EnOOQO'#Ij'#IjO1XQ`O'#GrO1dQ`O'#EmO1iQ`O'#EmO3hQ!0MxO'#JpO6[Q!0MxO'#JqO6uQ`O'#F[O6zQ,UO'#FsOOQ!0Lf'#Fe'#FeO7VO7dO'#FeO7eQMhO'#F{O9UQ`O'#FzOOQ!0Lf'#Jq'#JqOOQ!0Lb'#Jp'#JpO9ZQ`O'#GvOOQ['#K]'#K]O9fQ`O'#IWO9kQ!0LrO'#IXOOQ['#J^'#J^OOQ['#I]'#I]Q`QlOOQ`QlOOO9sQ!L^O'#DtO9zQlO'#D|O:RQlO'#EOO9aQ`O'#GrO:YQMhO'#CoO:hQ`O'#ElO:sQ`O'#EwO:xQMhO'#FdO;gQ`O'#GrOOQO'#K^'#K^O;lQ`O'#K^O;zQ`O'#GzO;zQ`O'#G{O;zQ`O'#G}O9aQ`O'#HQO<qQ`O'#HTO>YQ`O'#CeO>jQ`O'#HaO>rQ`O'#HgO>rQ`O'#HiO`QlO'#HkO>rQ`O'#HmO>rQ`O'#HpO>wQ`O'#HvO>|Q!0LsO'#H|O%[QlO'#IOO?XQ!0LsO'#IQO?dQ!0LsO'#ISO9kQ!0LrO'#IUO?oQ!0MxO'#CiO@qQpO'#DjQOQ`OOO%[QlO'#EOOAXQ`O'#ERO:YQMhO'#ElOAdQ`O'#ElOAoQ!bO'#FdOOQ['#Cg'#CgOOQ!0Lb'#Do'#DoOOQ!0Lb'#Jt'#JtO%[QlO'#JtOOQO'#Jw'#JwOOQO'#If'#IfOBoQpO'#EeOOQ!0Lb'#Ed'#EdOOQ!0Lb'#J{'#J{OCkQ!0MSO'#EeOCuQpO'#EUOOQO'#Jv'#JvODZQpO'#JwOEhQpO'#EUOCuQpO'#EePEuO&2DjO'#CbPOOO)CD{)CD{OOOO'#I^'#I^OFQO#tO,59UOOQ!0Lh,59U,59UOOOO'#I_'#I_OF`O&jO,59UOFnQ!L^O'#DaOOOO'#Ia'#IaOFuO#@ItO,59yOOQ!0Lf,59y,59yOGTQlO'#IbOGhQ`O'#JrOIgQ!fO'#JrO+}QlO'#JrOInQ`O,5:POJUQ`O'#EnOJcQ`O'#KROJnQ`O'#KQOJnQ`O'#KQOJvQ`O,5;[OJ{Q`O'#KPOOQ!0Ln,5:[,5:[OKSQlO,5:[OMQQ!0MxO,5:dOMqQ`O,5:lON[Q!0LrO'#KOONcQ`O'#J}O9ZQ`O'#J}ONwQ`O'#J}O! PQ`O,5;ZO! UQ`O'#J}O!#ZQ!fO'#JqOOQ!0Lh'#Ci'#CiO%[QlO'#EQO!#yQ!fO,5:qOOQS'#Jx'#JxOOQO-E<h-E<hO9aQ`O,5=^O!$aQ`O,5=^O!$fQlO,5;XO!&iQMhO'#EiO!(SQ`O,5;XO!(XQlO'#DwO!(cQpO,5;bO!(kQpO,5;bO%[QlO,5;bOOQ['#FS'#FSOOQ['#FU'#FUO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cO%[QlO,5;cOOQ['#FY'#FYO!(yQlO,5;sOOQ!0Lf,5;x,5;xOOQ!0Lf,5;y,5;yOOQ!0Lf,5;{,5;{O%[QlO'#InO!*|Q!0LrO,5<hO%[QlO,5;cO!&iQMhO,5;cO!+kQMhO,5;cO!-]QMhO'#E[O%[QlO,5;vOOQ!0Lf,5;z,5;zO!-dQ,UO'#FiO!.aQ,UO'#KVO!-{Q,UO'#KVO!.hQ,UO'#KVOOQO'#KV'#KVO!.|Q,UO,5<ROOOW,5<_,5<_O!/_QlO'#FuOOOW'#Im'#ImO7VO7dO,5<PO!/fQ,UO'#FwOOQ!0Lf,5<P,5<PO!0VQ$IUO'#CwOOQ!0Lh'#C{'#C{O!0jO#@ItO'#DPO!1WQMjO,5<dO!1_Q`O,5<gO!2zQ(CWO'#GWO!3XQ`O'#GXO!3^Q`O'#GXO!4|Q(CWO'#G]O!6RQpO'#GaOOQO'#Gm'#GmO!+rQMhO'#GlOOQO'#Go'#GoO!+rQMhO'#GnO!6tQ$IUO'#JjOOQ!0Lh'#Jj'#JjO!7OQ`O'#JiO!7^Q`O'#JhO!7fQ`O'#CuOOQ!0Lh'#Cy'#CyO!7qQ`O'#C{OOQ!0Lh'#DT'#DTOOQ!0Lh'#DV'#DVO1SQ`O'#DXO!+rQMhO'#GOO!+rQMhO'#GQO!7vQ`O'#GSO!7{Q`O'#GTO!3^Q`O'#GZO!+rQMhO'#G`O;zQ`O'#JiO!8QQ`O'#EoO!8oQ`O,5<fOOQ!0Lb'#Cr'#CrO!8wQ`O'#EpO!9qQpO'#EqOOQ!0Lb'#KP'#KPO!9xQ!0LrO'#K_O9kQ!0LrO,5=bO`QlO,5>rOOQ['#Jf'#JfOOQ[,5>s,5>sOOQ[-E<Z-E<ZO!;wQ!0MxO,5:`O!9lQpO,5:^O!>bQ!0MxO,5:hO%[QlO,5:hO!@xQ!0MxO,5:jOOQO,5@x,5@xO!AiQMhO,5=^O!AwQ!0LrO'#JgO9UQ`O'#JgO!BYQ!0LrO,59ZO!BeQpO,59ZO!BmQMhO,59ZO:YQMhO,59ZO!BxQ`O,5;XO!CQQ`O'#H`O!CfQ`O'#KbO%[QlO,5;|O!9lQpO,5<OO!CnQ`O,5=yO!CsQ`O,5=yO!CxQ`O,5=yO9kQ!0LrO,5=yO;zQ`O,5=iOOQO'#Cw'#CwO!DWQpO,5=fO!D`QMhO,5=gO!DkQ`O,5=iO!DpQ!bO,5=lO!DxQ`O'#K^O>wQ`O'#HVO9aQ`O'#HXO!D}Q`O'#HXO:YQMhO'#HZO!ESQ`O'#HZOOQ[,5=o,5=oO!EXQ`O'#H[O!EjQ`O'#CoO!EoQ`O,59PO!EyQ`O,59PO!HOQlO,59POOQ[,59P,59PO!H`Q!0LrO,59PO%[QlO,59PO!JkQlO'#HcOOQ['#Hd'#HdOOQ['#He'#HeO`QlO,5={O!KRQ`O,5={O`QlO,5>RO`QlO,5>TO!KWQ`O,5>VO`QlO,5>XO!K]Q`O,5>[O!KbQlO,5>bOOQ[,5>h,5>hO%[QlO,5>hO9kQ!0LrO,5>jOOQ[,5>l,5>lO# lQ`O,5>lOOQ[,5>n,5>nO# lQ`O,5>nOOQ[,5>p,5>pO#!YQpO'#D]O%[QlO'#JtO#!{QpO'#JtO##VQpO'#DkO##hQpO'#DkO#%yQlO'#DkO#&QQ`O'#JsO#&YQ`O,5:UO#&_Q`O'#ErO#&mQ`O'#KSO#&uQ`O,5;]O#&zQpO'#DkO#'XQpO'#ETOOQ!0Lf,5:m,5:mO%[QlO,5:mO#'`Q`O,5:mO>wQ`O,5;WO!BeQpO,5;WO!BmQMhO,5;WO:YQMhO,5;WO#'hQ`O,5@`O#'mQ07dO,5:qOOQO-E<d-E<dO#(sQ!0MSO,5;POCuQpO,5:pO#(}QpO,5:pOCuQpO,5;PO!BYQ!0LrO,5:pOOQ!0Lb'#Eh'#EhOOQO,5;P,5;PO%[QlO,5;PO#)[Q!0LrO,5;PO#)gQ!0LrO,5;PO!BeQpO,5:pOOQO,5;V,5;VO#)uQ!0LrO,5;PPOOO'#I['#I[P#*ZO&2DjO,58|POOO,58|,58|OOOO-E<[-E<[OOQ!0Lh1G.p1G.pOOOO-E<]-E<]OOOO,59{,59{O#*fQ!bO,59{OOOO-E<_-E<_OOQ!0Lf1G/e1G/eO#*kQ!fO,5>|O+}QlO,5>|OOQO,5?S,5?SO#*uQlO'#IbOOQO-E<`-E<`O#+SQ`O,5@^O#+[Q!fO,5@^O#+cQ`O,5@lOOQ!0Lf1G/k1G/kO%[QlO,5@mO#+kQ`O'#IhOOQO-E<f-E<fO#+cQ`O,5@lOOQ!0Lb1G0v1G0vOOQ!0Ln1G/v1G/vOOQ!0Ln1G0W1G0WO%[QlO,5@jO#,PQ!0LrO,5@jO#,bQ!0LrO,5@jO#,iQ`O,5@iO9ZQ`O,5@iO#,qQ`O,5@iO#-PQ`O'#IkO#,iQ`O,5@iOOQ!0Lb1G0u1G0uO!(cQpO,5:sO!(nQpO,5:sOOQS,5:u,5:uO#-qQdO,5:uO#-yQMhO1G2xO9aQ`O1G2xOOQ!0Lf1G0s1G0sO#.XQ!0MxO1G0sO#/^Q!0MvO,5;TOOQ!0Lh'#GV'#GVO#/zQ!0MzO'#JjO!$fQlO1G0sO#2VQ!fO'#JuO%[QlO'#JuO#2aQ`O,5:cOOQ!0Lh'#D]'#D]OOQ!0Lf1G0|1G0|O%[QlO1G0|OOQ!0Lf1G1e1G1eO#2fQ`O1G0|O#4zQ!0MxO1G0}O#5RQ!0MxO1G0}O#7iQ!0MxO1G0}O#7pQ!0MxO1G0}O#:WQ!0MxO1G0}O#<nQ!0MxO1G0}O#<uQ!0MxO1G0}O#<|Q!0MxO1G0}O#?dQ!0MxO1G0}O#?kQ!0MxO1G0}O#AxQ?MtO'#CiO#CsQ?MtO1G1_O#CzQ?MtO'#JqO#D_Q!0MxO,5?YOOQ!0Lb-E<l-E<lO#FlQ!0MxO1G0}O#GiQ!0MzO1G0}OOQ!0Lf1G0}1G0}O#HlQMjO'#JzO#HvQ`O,5:vO#H{Q!0MxO1G1bO#IoQ,UO,5<VO#IwQ,UO,5<WO#JPQ,UO'#FnO#JhQ`O'#FmOOQO'#KW'#KWOOQO'#Il'#IlO#JmQ,UO1G1mOOQ!0Lf1G1m1G1mOOOW1G1x1G1xO#KOQ?MtO'#JpO#KYQ`O,5<aO!(yQlO,5<aOOOW-E<k-E<kOOQ!0Lf1G1k1G1kO#K_QpO'#KVOOQ!0Lf,5<c,5<cO#KgQpO,5<cO#KlQMhO'#DROOOO'#I`'#I`O#KsO#@ItO,59kOOQ!0Lh,59k,59kO%[QlO1G2OO!7{Q`O'#IpO#LOQ`O,5<yOOQ!0Lh,5<v,5<vO!+rQMhO'#IsO#LlQMjO,5=WO!+rQMhO'#IuO#M_QMjO,5=YO!&iQMhO,5=[OOQO1G2R1G2RO#MiQ!dO'#CrO#M|Q(CWO'#EpO$ RQpO'#GaO$ iQ!dO,5<rO$ pQ`O'#KYO9ZQ`O'#KYO$!OQ`O,5<tO!+rQMhO,5<sO$!TQ`O'#GYO$!fQ`O,5<sO$!kQ!dO'#GVO$!xQ!dO'#KZO$#SQ`O'#KZO!&iQMhO'#KZO$#XQ`O,5<wO$#^QlO'#JtO$#hQpO'#GbO##hQpO'#GbO$#yQ`O'#GfO!3^Q`O'#GjO$$OQ!0LrO'#IrO$$ZQpO,5<{OOQ!0Lp,5<{,5<{O$$bQpO'#GbO$$oQpO'#GcO$%QQpO'#GcO$%VQMjO,5=WO$%gQMjO,5=YOOQ!0Lh,5=],5=]O!+rQMhO,5@TO!+rQMhO,5@TO$%wQ`O'#IwO$&VQ`O,5@SO$&_Q`O,59aOOQ!0Lh,59g,59gO$'UQ$IYO,59sOOQ!0Lh'#Jn'#JnO$'wQMjO,5<jO$(jQMjO,5<lO@iQ`O,5<nOOQ!0Lh,5<o,5<oO$(tQ`O,5<uO$(yQMjO,5<zO$)ZQ`O,5@TO$)iQ`O'#J}O!$fQlO1G2QO$)nQ`O1G2QO9ZQ`O'#KQO9ZQ`O'#ErO%[QlO'#ErO9ZQ`O'#IyO$)sQ!0LrO,5@yOOQ[1G2|1G2|OOQ[1G4^1G4^OOQ!0Lf1G/z1G/zOOQ!0Lf1G/x1G/xO$+uQ!0MxO1G0SOOQ[1G2x1G2xO!&iQMhO1G2xO%[QlO1G2xO#-|Q`O1G2xO$-yQMhO'#EiOOQ!0Lb,5@R,5@RO$.WQ!0LrO,5@ROOQ[1G.u1G.uO!BYQ!0LrO1G.uO!BeQpO1G.uO!BmQMhO1G.uO$.iQ`O1G0sO$.nQ`O'#CiO$.yQ`O'#KcO$/RQ`O,5=zO$/WQ`O'#KcO$/]Q`O'#KcO$/kQ`O'#JPO$/yQ`O,5@|O$0RQ!fO1G1hOOQ!0Lf1G1j1G1jO9aQ`O1G3eO@iQ`O1G3eO$0YQ`O1G3eO$0_Q`O1G3eOOQ[1G3e1G3eO!DkQ`O1G3TO!&iQMhO1G3QO$0dQ`O1G3QOOQ[1G3R1G3RO!&iQMhO1G3RO$0iQ`O1G3RO$0qQpO'#HPOOQ[1G3T1G3TO!5|QpO'#I{O!DpQ!bO1G3WOOQ[1G3W1G3WOOQ[,5=q,5=qO$0yQMhO,5=sO9aQ`O,5=sO$#yQ`O,5=uO9UQ`O,5=uO!BeQpO,5=uO!BmQMhO,5=uO:YQMhO,5=uO$1XQ`O'#KaO$1dQ`O,5=vOOQ[1G.k1G.kO$1iQ!0LrO1G.kO@iQ`O1G.kO$1tQ`O1G.kO9kQ!0LrO1G.kO$3|Q!fO,5AOO$4ZQ`O,5AOO9ZQ`O,5AOO$4fQlO,5=}O$4mQ`O,5=}OOQ[1G3g1G3gO`QlO1G3gOOQ[1G3m1G3mOOQ[1G3o1G3oO>rQ`O1G3qO$4rQlO1G3sO$8vQlO'#HrOOQ[1G3v1G3vO$9TQ`O'#HxO>wQ`O'#HzOOQ[1G3|1G3|O$9]QlO1G3|O9kQ!0LrO1G4SOOQ[1G4U1G4UOOQ!0Lb'#G^'#G^O9kQ!0LrO1G4WO9kQ!0LrO1G4YO$=dQ`O,5@`O!(yQlO,5;^O9ZQ`O,5;^O>wQ`O,5:VO!(yQlO,5:VO!BeQpO,5:VO$=iQ?MtO,5:VOOQO,5;^,5;^O$=sQpO'#IcO$>ZQ`O,5@_OOQ!0Lf1G/p1G/pO$>cQpO'#IiO$>mQ`O,5@nOOQ!0Lb1G0w1G0wO##hQpO,5:VOOQO'#Ie'#IeO$>uQpO,5:oOOQ!0Ln,5:o,5:oO#'cQ`O1G0XOOQ!0Lf1G0X1G0XO%[QlO1G0XOOQ!0Lf1G0r1G0rO>wQ`O1G0rO!BeQpO1G0rO!BmQMhO1G0rOOQ!0Lb1G5z1G5zO!BYQ!0LrO1G0[OOQO1G0k1G0kO%[QlO1G0kO$>|Q!0LrO1G0kO$?XQ!0LrO1G0kO!BeQpO1G0[OCuQpO1G0[O$?gQ!0LrO1G0kOOQO1G0[1G0[O$?{Q!0MxO1G0kPOOO-E<Y-E<YPOOO1G.h1G.hOOOO1G/g1G/gO$@VQ!bO,5<hO$@_Q!fO1G4hOOQO1G4n1G4nO%[QlO,5>|O$@iQ`O1G5xO$@qQ`O1G6WO$@yQ!fO1G6XO9ZQ`O,5?SO$ATQ!0MxO1G6UO%[QlO1G6UO$AeQ!0LrO1G6UO$AvQ`O1G6TO$AvQ`O1G6TO9ZQ`O1G6TO$BOQ`O,5?VO9ZQ`O,5?VOOQO,5?V,5?VO$BdQ`O,5?VO$)iQ`O,5?VOOQO-E<i-E<iOOQS1G0_1G0_OOQS1G0a1G0aO#-tQ`O1G0aOOQ[7+(d7+(dO!&iQMhO7+(dO%[QlO7+(dO$BrQ`O7+(dO$B}QMhO7+(dO$C]Q!0MzO,5=WO$EhQ!0MzO,5=YO$GsQ!0MzO,5=WO$JUQ!0MzO,5=YO$LgQ!0MzO,59sO$NlQ!0MzO,5<jO%!wQ!0MzO,5<lO%%SQ!0MzO,5<zOOQ!0Lf7+&_7+&_O%'eQ!0MxO7+&_O%(XQlO'#IdO%(fQ`O,5@aO%(nQ!fO,5@aOOQ!0Lf1G/}1G/}O%(xQ`O7+&hOOQ!0Lf7+&h7+&hO%(}Q?MtO,5:dO%[QlO7+&yO%)XQ?MtO,5:`O%)fQ?MtO,5:hO%)pQ?MtO,5:jO%)zQMhO'#IgO%*UQ`O,5@fOOQ!0Lh1G0b1G0bOOQO1G1q1G1qOOQO1G1r1G1rO%*^Q!jO,5<YO!(yQlO,5<XOOQO-E<j-E<jOOQ!0Lf7+'X7+'XOOOW7+'d7+'dOOOW1G1{1G1{O%*iQ`O1G1{OOQ!0Lf1G1}1G1}OOOO,59m,59mO%*nQ!dO,59mOOOO-E<^-E<^OOQ!0Lh1G/V1G/VO%*uQ!0MxO7+'jOOQ!0Lh,5?[,5?[O%+iQMhO1G2eP%+pQ`O'#IpPOQ!0Lh-E<n-E<nO%,^QMjO,5?_OOQ!0Lh-E<q-E<qO%-PQMjO,5?aOOQ!0Lh-E<s-E<sO%-ZQ!dO1G2vO%-bQ!dO'#CrO%-xQMhO'#KQO$#^QlO'#JtOOQ!0Lh1G2^1G2^O%.PQ`O'#IoO%.eQ`O,5@tO%.eQ`O,5@tO%.mQ`O,5@tO%.xQ`O,5@tOOQO1G2`1G2`O%/WQMjO1G2_O!+rQMhO1G2_O%/hQ(CWO'#IqO%/uQ`O,5@uO!&iQMhO,5@uO%/}Q!dO,5@uOOQ!0Lh1G2c1G2cO%2_Q!fO'#CiO%2iQ`O,5=OOOQ!0Lb,5<|,5<|O%2qQpO,5<|OOQ!0Lb,5<},5<}OCfQ`O,5<|O%2|QpO,5<|OOQ!0Lb,5=Q,5=QO$)iQ`O,5=UOOQO,5?^,5?^OOQO-E<p-E<pOOQ!0Lp1G2g1G2gO##hQpO,5<|O$#^QlO,5=OO%3[Q`O,5<}O%3gQpO,5<}O!+rQMhO'#IsO%4aQMjO1G2rO!+rQMhO'#IuO%5SQMjO1G2tO%5^QMjO1G5oO%5hQMjO1G5oOOQO,5?c,5?cOOQO-E<u-E<uOOQO1G.{1G.{O!9lQpO,59uO%[QlO,59uOOQ!0Lh,5<i,5<iO%5uQ`O1G2YO!+rQMhO1G2aO!+rQMhO1G5oO!+rQMhO1G5oO%5zQ!0MxO7+'lOOQ!0Lf7+'l7+'lO!$fQlO7+'lO%6nQ`O,5;^OOQ!0Lb,5?e,5?eOOQ!0Lb-E<w-E<wO%6sQ!dO'#K[O#'cQ`O7+(dO4UQ!fO7+(dO$BuQ`O7+(dO%6}Q!0MvO'#CiO%7nQ!0LrO,5=RO%8PQ!0MvO,5=RO%8dQ`O,5=ROOQ!0Lb1G5m1G5mOOQ[7+$a7+$aO!BYQ!0LrO7+$aO!BeQpO7+$aO!$fQlO7+&_O%8lQ`O'#JOO%9TQ`O,5@}OOQO1G3f1G3fO9aQ`O,5@}O%9TQ`O,5@}O%9]Q`O,5@}OOQO,5?k,5?kOOQO-E<}-E<}OOQ!0Lf7+'S7+'SO%9bQ`O7+)PO9kQ!0LrO7+)PO9aQ`O7+)PO@iQ`O7+)POOQ[7+(o7+(oO%9gQ!0MvO7+(lO!&iQMhO7+(lO!DfQ`O7+(mOOQ[7+(m7+(mO!&iQMhO7+(mO%9qQ`O'#K`O%9|Q`O,5=kOOQO,5?g,5?gOOQO-E<y-E<yOOQ[7+(r7+(rO%;`QpO'#HYOOQ[1G3_1G3_O!&iQMhO1G3_O%[QlO1G3_O%;gQ`O1G3_O%;rQMhO1G3_O9kQ!0LrO1G3aO$#yQ`O1G3aO9UQ`O1G3aO!BeQpO1G3aO!BmQMhO1G3aO%<QQ`O'#I}O%<fQ`O,5@{O%<nQpO,5@{OOQ!0Lb1G3b1G3bOOQ[7+$V7+$VO@iQ`O7+$VO9kQ!0LrO7+$VO%<yQ`O7+$VO%[QlO1G6jO%[QlO1G6kO%=OQ!0LrO1G6jO%=YQlO1G3iO%=aQ`O1G3iO%=fQlO1G3iOOQ[7+)R7+)RO9kQ!0LrO7+)]O`QlO7+)_OOQ['#Kf'#KfOOQ['#JQ'#JQO%=mQlO,5>^OOQ[,5>^,5>^O%[QlO'#HsO%=zQ`O'#HuOOQ[,5>d,5>dO9ZQ`O,5>dOOQ[,5>f,5>fOOQ[7+)h7+)hOOQ[7+)n7+)nOOQ[7+)r7+)rOOQ[7+)t7+)tO%>PQpO1G5zO%>kQ?MtO1G0xO%>uQ`O1G0xOOQO1G/q1G/qO%?QQ?MtO1G/qO>wQ`O1G/qO!(yQlO'#DkOOQO,5>},5>}OOQO-E<a-E<aOOQO,5?T,5?TOOQO-E<g-E<gO!BeQpO1G/qOOQO-E<c-E<cOOQ!0Ln1G0Z1G0ZOOQ!0Lf7+%s7+%sO#'cQ`O7+%sOOQ!0Lf7+&^7+&^O>wQ`O7+&^O!BeQpO7+&^OOQO7+%v7+%vO$?{Q!0MxO7+&VOOQO7+&V7+&VO%[QlO7+&VO%?[Q!0LrO7+&VO!BYQ!0LrO7+%vO!BeQpO7+%vO%?gQ!0LrO7+&VO%?uQ!0MxO7++pO%[QlO7++pO%@VQ`O7++oO%@VQ`O7++oOOQO1G4q1G4qO9ZQ`O1G4qO%@_Q`O1G4qOOQS7+%{7+%{O#'cQ`O<<LOO4UQ!fO<<LOO%@mQ`O<<LOOOQ[<<LO<<LOO!&iQMhO<<LOO%[QlO<<LOO%@uQ`O<<LOO%AQQ!0MzO,5?_O%C]Q!0MzO,5?aO%EhQ!0MzO1G2_O%GyQ!0MzO1G2rO%JUQ!0MzO1G2tO%LaQ!fO,5?OO%[QlO,5?OOOQO-E<b-E<bO%LkQ`O1G5{OOQ!0Lf<<JS<<JSO%LsQ?MtO1G0sO%NzQ?MtO1G0}O& RQ?MtO1G0}O&#SQ?MtO1G0}O&#ZQ?MtO1G0}O&%[Q?MtO1G0}O&']Q?MtO1G0}O&'dQ?MtO1G0}O&'kQ?MtO1G0}O&)lQ?MtO1G0}O&)sQ?MtO1G0}O&)zQ!0MxO<<JeO&+rQ?MtO1G0}O&,oQ?MvO1G0}O&-rQ?MvO'#JjO&/xQ?MtO1G1bO&0VQ?MtO1G0SO&0aQMjO,5?ROOQO-E<e-E<eO!(yQlO'#FpOOQO'#KX'#KXOOQO1G1t1G1tO&0kQ`O1G1sO&0pQ?MtO,5?YOOOW7+'g7+'gOOOO1G/X1G/XO&0zQ!dO1G4vOOQ!0Lh7+(P7+(PP!&iQMhO,5?[O!+rQMhO7+(bO&1RQ`O,5?ZO9ZQ`O,5?ZOOQO-E<m-E<mO&1aQ`O1G6`O&1aQ`O1G6`O&1iQ`O1G6`O&1tQMjO7+'yO&2UQ!dO,5?]O&2`Q`O,5?]O!&iQMhO,5?]OOQO-E<o-E<oO&2eQ!dO1G6aO&2oQ`O1G6aO&2wQ`O1G2jO!&iQMhO1G2jOOQ!0Lb1G2h1G2hOOQ!0Lb1G2i1G2iO%2qQpO1G2hO!BeQpO1G2hOCfQ`O1G2hOOQ!0Lb1G2p1G2pO&2|QpO1G2hO&3[Q`O1G2jO$)iQ`O1G2iOCfQ`O1G2iO$#^QlO1G2jO&3dQ`O1G2iO&4WQMjO,5?_OOQ!0Lh-E<r-E<rO&4yQMjO,5?aOOQ!0Lh-E<t-E<tO!+rQMhO7++ZOOQ!0Lh1G/a1G/aO&5TQ`O1G/aOOQ!0Lh7+'t7+'tO&5YQMjO7+'{O&5jQMjO7++ZO&5tQMjO7++ZO&6RQ!0MxO<<KWOOQ!0Lf<<KW<<KWO&6uQ`O1G0xO!&iQMhO'#IxO&6zQ`O,5@vO&8|Q!fO<<LOO!&iQMhO1G2mO&9TQ!0LrO1G2mOOQ[<<G{<<G{O!BYQ!0LrO<<G{O&9fQ!0MxO<<IyOOQ!0Lf<<Iy<<IyOOQO,5?j,5?jO&:YQ`O,5?jO&:_Q`O,5?jOOQO-E<|-E<|O&:mQ`O1G6iO&:mQ`O1G6iO9aQ`O1G6iO@iQ`O<<LkOOQ[<<Lk<<LkO&:uQ`O<<LkO9kQ!0LrO<<LkOOQ[<<LW<<LWO%9gQ!0MvO<<LWOOQ[<<LX<<LXO!DfQ`O<<LXO&:zQpO'#IzO&;VQ`O,5@zO!(yQlO,5@zOOQ[1G3V1G3VOOQO'#I|'#I|O9kQ!0LrO'#I|O&;_QpO,5=tOOQ[,5=t,5=tO&;fQpO'#EeO&;mQpO'#GdO&;rQ`O7+(yO&;wQ`O7+(yOOQ[7+(y7+(yO!&iQMhO7+(yO%[QlO7+(yO&<PQ`O7+(yOOQ[7+({7+({O9kQ!0LrO7+({O$#yQ`O7+({O9UQ`O7+({O!BeQpO7+({O&<[Q`O,5?iOOQO-E<{-E<{OOQO'#H]'#H]O&<gQ`O1G6gO9kQ!0LrO<<GqOOQ[<<Gq<<GqO@iQ`O<<GqO&<oQ`O7+,UO&<tQ`O7+,VO%[QlO7+,UO%[QlO7+,VOOQ[7+)T7+)TO&<yQ`O7+)TO&=OQlO7+)TO&=VQ`O7+)TOOQ[<<Lw<<LwOOQ[<<Ly<<LyOOQ[-E=O-E=OOOQ[1G3x1G3xO&=[Q`O,5>_OOQ[,5>a,5>aO&=aQ`O1G4OO9ZQ`O7+&dO!(yQlO7+&dOOQO7+%]7+%]O&=fQ?MtO1G6XO>wQ`O7+%]OOQ!0Lf<<I_<<I_OOQ!0Lf<<Ix<<IxO>wQ`O<<IxOOQO<<Iq<<IqO$?{Q!0MxO<<IqO%[QlO<<IqOOQO<<Ib<<IbO!BYQ!0LrO<<IbO&=pQ!0LrO<<IqO&={Q!0MxO<= [O&>]Q`O<= ZOOQO7+*]7+*]O9ZQ`O7+*]OOQ[ANAjANAjO&>eQ!fOANAjO!&iQMhOANAjO#'cQ`OANAjO4UQ!fOANAjO&>lQ`OANAjO%[QlOANAjO&>tQ!0MzO7+'yO&AVQ!0MzO,5?_O&CbQ!0MzO,5?aO&EmQ!0MzO7+'{O&HOQ!fO1G4jO&HYQ?MtO7+&_O&J^Q?MvO,5=WO&LeQ?MvO,5=YO&LuQ?MvO,5=WO&MVQ?MvO,5=YO&MgQ?MvO,59sO' mQ?MvO,5<jO'#pQ?MvO,5<lO'&UQ?MvO,5<zO''zQ?MtO7+'jO'(XQ?MtO7+'lO'(fQ`O,5<[OOQO7+'_7+'_OOQ!0Lh7+*b7+*bO'(kQMjO<<K|OOQO1G4u1G4uO'(rQ`O1G4uO'(}Q`O1G4uO')]Q`O7++zO')]Q`O7++zO!&iQMhO1G4wO')eQ!dO1G4wO')oQ`O7++{O')wQ`O7+(UO'*SQ!dO7+(UOOQ!0Lb7+(S7+(SOOQ!0Lb7+(T7+(TO!BeQpO7+(SOCfQ`O7+(SO'*^Q`O7+(UO!&iQMhO7+(UO$)iQ`O7+(TO'*cQ`O7+(UOCfQ`O7+(TO'*kQMjO<<NuOOQ!0Lh7+${7+${O!+rQMhO<<NuO'*uQ!dO,5?dOOQO-E<v-E<vO'+PQ!0MvO7+(XO!&iQMhO7+(XOOQ[AN=gAN=gO9aQ`O1G5UOOQO1G5U1G5UO'+aQ`O1G5UO'+fQ`O7+,TO'+fQ`O7+,TO9kQ!0LrOANBVO@iQ`OANBVOOQ[ANBVANBVOOQ[ANArANArOOQ[ANAsANAsO'+nQ`O,5?fOOQO-E<x-E<xO'+yQ?MtO1G6fOOQO,5?h,5?hOOQO-E<z-E<zOOQ[1G3`1G3`O',TQ`O,5=OOOQ[<<Le<<LeO!&iQMhO<<LeO&;rQ`O<<LeO',YQ`O<<LeO%[QlO<<LeOOQ[<<Lg<<LgO9kQ!0LrO<<LgO$#yQ`O<<LgO9UQ`O<<LgO',bQpO1G5TO',mQ`O7+,ROOQ[AN=]AN=]O9kQ!0LrOAN=]OOQ[<= p<= pOOQ[<= q<= qO',uQ`O<= pO',zQ`O<= qOOQ[<<Lo<<LoO'-PQ`O<<LoO'-UQlO<<LoOOQ[1G3y1G3yO>wQ`O7+)jO'-]Q`O<<JOO'-hQ?MtO<<JOOOQO<<Hw<<HwOOQ!0LfAN?dAN?dOOQOAN?]AN?]O$?{Q!0MxOAN?]OOQOAN>|AN>|O%[QlOAN?]OOQO<<Mw<<MwOOQ[G27UG27UO!&iQMhOG27UO#'cQ`OG27UO'-rQ!fOG27UO4UQ!fOG27UO'-yQ`OG27UO'.RQ?MtO<<JeO'.`Q?MvO1G2_O'0UQ?MvO,5?_O'2XQ?MvO,5?aO'4[Q?MvO1G2rO'6_Q?MvO1G2tO'8bQ?MtO<<KWO'8oQ?MtO<<IyOOQO1G1v1G1vO!+rQMhOANAhOOQO7+*a7+*aO'8|Q`O7+*aO'9XQ`O<= fO'9aQ!dO7+*cOOQ!0Lb<<Kp<<KpO$)iQ`O<<KpOCfQ`O<<KpO'9kQ`O<<KpO!&iQMhO<<KpOOQ!0Lb<<Kn<<KnO!BeQpO<<KnO'9vQ!dO<<KpOOQ!0Lb<<Ko<<KoO':QQ`O<<KpO!&iQMhO<<KpO$)iQ`O<<KoO':VQMjOANDaO':aQ!0MvO<<KsOOQO7+*p7+*pO9aQ`O7+*pO':qQ`O<= oOOQ[G27qG27qO9kQ!0LrOG27qO!(yQlO1G5QO':yQ`O7+,QO';RQ`O1G2jO&;rQ`OANBPOOQ[ANBPANBPO!&iQMhOANBPO';WQ`OANBPOOQ[ANBRANBRO9kQ!0LrOANBRO$#yQ`OANBROOQO'#H^'#H^OOQO7+*o7+*oOOQ[G22wG22wOOQ[ANE[ANE[OOQ[ANE]ANE]OOQ[ANBZANBZO';`Q`OANBZOOQ[<<MU<<MUO!(yQlOAN?jOOQOG24wG24wO$?{Q!0MxOG24wO#'cQ`OLD,pOOQ[LD,pLD,pO!&iQMhOLD,pO';eQ!fOLD,pO';lQ?MvO7+'yO'=bQ?MvO,5?_O'?eQ?MvO,5?aO'AhQ?MvO7+'{O'C^QMjOG27SOOQO<<M{<<M{OOQ!0LbANA[ANA[O$)iQ`OANA[OCfQ`OANA[O'CnQ!dOANA[OOQ!0LbANAYANAYO'CuQ`OANA[O!&iQMhOANA[O'DQQ!dOANA[OOQ!0LbANAZANAZOOQO<<N[<<N[OOQ[LD-]LD-]O'D[Q?MtO7+*lOOQO'#Ge'#GeOOQ[G27kG27kO&;rQ`OG27kO!&iQMhOG27kOOQ[G27mG27mO9kQ!0LrOG27mOOQ[G27uG27uO'DfQ?MtOG25UOOQOLD*cLD*cOOQ[!$(![!$(![O#'cQ`O!$(![O!&iQMhO!$(![O'DpQ!0MzOG27SOOQ!0LbG26vG26vO$)iQ`OG26vO'GRQ`OG26vOCfQ`OG26vO'G^Q!dOG26vO!&iQMhOG26vOOQ[LD-VLD-VO&;rQ`OLD-VOOQ[LD-XLD-XOOQ[!)9Ev!)9EvO#'cQ`O!)9EvOOQ!0LbLD,bLD,bO$)iQ`OLD,bOCfQ`OLD,bO'GeQ`OLD,bO'GpQ!dOLD,bOOQ[!$(!q!$(!qOOQ[!.K;b!.K;bO'GwQ?MvOG27SOOQ!0Lb!$( |!$( |O$)iQ`O!$( |OCfQ`O!$( |O'ImQ`O!$( |OOQ!0Lb!)9Eh!)9EhO$)iQ`O!)9EhOCfQ`O!)9EhOOQ!0Lb!.K;S!.K;SO$)iQ`O!.K;SOOQ!0Lb!4/0n!4/0nO!(yQlO'#DxO1PQ`O'#EVO'IxQ!fO'#JpO'JPQ!L^O'#DtO'JWQlO'#D|O'J_Q!fO'#CiO'LuQ!fO'#CiO!(yQlO'#EOO'MVQlO,5;XO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO,5;cO!(yQlO'#InO( YQ`O,5<hO!(yQlO,5;cO( bQMhO,5;cO(!{QMhO,5;cO!(yQlO,5;vO!&iQMhO'#GlO( bQMhO'#GlO!&iQMhO'#GnO( bQMhO'#GnO1SQ`O'#DXO1SQ`O'#DXO!&iQMhO'#GOO( bQMhO'#GOO!&iQMhO'#GQO( bQMhO'#GQO!&iQMhO'#G`O( bQMhO'#G`O!(yQlO,5:hO(#SQpO'#D]O(#^QpO'#JtO!(yQlO,5@mO'MVQlO1G0sO(#hQ?MtO'#CiO!(yQlO1G2OO!&iQMhO'#IsO( bQMhO'#IsO!&iQMhO'#IuO( bQMhO'#IuO(#rQ!dO'#CrO!&iQMhO,5<sO( bQMhO,5<sO'MVQlO1G2QO!(yQlO7+&yO!&iQMhO1G2_O( bQMhO1G2_O!&iQMhO'#IsO( bQMhO'#IsO!&iQMhO'#IuO( bQMhO'#IuO!&iQMhO1G2aO( bQMhO1G2aO'MVQlO7+'lO'MVQlO7+&_O!&iQMhOANAhO( bQMhOANAhO($VQ`O'#EmO($[Q`O'#EmO($dQ`O'#F[O($iQ`O'#EwO($nQ`O'#KRO($yQ`O'#KPO(%UQ`O,5;XO(%ZQMjO,5<dO(%bQ`O'#GXO(%gQ`O'#GXO(%lQ`O,5<fO(%tQ`O,5;XO(%|Q?MtO1G1_O(&TQ`O,5<sO(&YQ`O,5<sO(&_Q`O,5<uO(&dQ`O,5<uO(&iQ`O1G2QO(&nQ`O1G0sO(&sQMjO<<K|O(&zQMjO<<K|O7eQMhO'#F{O9UQ`O'#FzOAdQ`O'#ElO!(yQlO,5;sO!3^Q`O'#GXO!3^Q`O'#GXO!3^Q`O'#GZO!3^Q`O'#GZO!+rQMhO7+(bO!+rQMhO7+(bO%-ZQ!dO1G2vO%-ZQ!dO1G2vO!&iQMhO,5=[O!&iQMhO,5=[",
  stateData: "((P~O'zOS'{OSTOS'|RQ~OPYOQYOSfOY!VOaqOdzOeyOj!POnkOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!]XO!guO!jZO!mYO!nYO!oYO!qvO!swO!vxO!z]O$V|O$miO%g}O%i!QO%k!OO%l!OO%m!OO%p!RO%r!SO%u!TO%v!TO%x!UO&U!WO&[!XO&^!YO&`!ZO&b![O&e!]O&k!^O&q!_O&s!`O&u!aO&w!bO&y!cO(RSO(TTO(WUO(_VO(m[O~OWtO~P`OPYOQYOSfOd!jOe!iOnkOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!]!eO!guO!jZO!mYO!nYO!oYO!qvO!s!gO!v!hO$V!kO$miO(R!dO(TTO(WUO(_VO(m[O~Oa!wOq!nO!Q!oO!`!yO!a!vO!b!vO!z;wO#R!pO#S!pO#T!xO#U!pO#V!pO#Y!zO#Z!zO(S!lO(TTO(WUO(c!mO(m!sO~O'|!{O~OP]XR]X[]Xa]Xp]X!O]X!Q]X!Z]X!j]X!n]X#P]X#Q]X#^]X#ifX#l]X#m]X#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#w]X#y]X#z]X$P]X'x]X(_]X(p]X(w]X(x]X~O!e%QX~P(qO_!}O(T#PO(U!}O(V#PO~O_#QO(V#PO(W#PO(X#QO~Ov#SO!S#TO(`#TO(a#VO~OPYOQYOSfOd!jOe!iOnkOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!]!eO!guO!jZO!mYO!nYO!oYO!qvO!s!gO!v!hO$V!kO$miO(R;{O(TTO(WUO(_VO(m[O~O!Y#ZO!Z#WO!W(fP!W(tP~P+}O![#cO~P`OPYOQYOSfOd!jOe!iOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!]!eO!guO!jZO!mYO!nYO!oYO!qvO!s!gO!v!hO$V!kO$miO(TTO(WUO(_VO(m[O~On#mO!Y#iO!z]O#g#lO#h#iO(R;|O!i(qP~P.iO!j#oO(R#nO~O!v#sO!z]O%g#tO~O#i#uO~O!e#vO#i#uO~OP$[OR#zO[$cOp$aO!O#yO!Q#{O!Z$_O!j#xO!n$[O#P$RO#l$OO#m$PO#n$PO#o$PO#p$QO#q$RO#r$RO#s$bO#t$RO#u$SO#w$UO#y$WO#z$XO(_VO(p$YO(w#|O(x#}O~Oa(dX'x(dX'u(dX!i(dX!W(dX!](dX%h(dX!e(dX~P1qO#Q$dO#^$eO$P$eOP(eXR(eX[(eXp(eX!O(eX!Q(eX!Z(eX!j(eX!n(eX#P(eX#l(eX#m(eX#n(eX#o(eX#p(eX#q(eX#r(eX#s(eX#t(eX#u(eX#w(eX#y(eX#z(eX(_(eX(p(eX(w(eX(x(eX!](eX%h(eX~Oa(eX'x(eX'u(eX!W(eX!i(eXt(eX!e(eX~P4UO#^$eO~O$[$hO$^$gO$e$mO~OSfO!]$nO$h$oO$j$qO~Oh%VOj%cOn%WOp%XOq$tOr$tOx%YOz%ZO|%[O!Q${O!]$|O!g%aO!j$xO#h%bO$V%_O$s%]O$u%^O$x%`O(R$sO(TTO(WUO(_$uO(w$}O(x%POg([P~O!j%dO~O!Q%gO!]%hO(R%fO~O!e%lO~Oa%mO'x%mO~O!O%qO~P%[O(S!lO~P%[O%m%uO~P%[Oh%VO!j%dO(R%fO(S!lO~Oe%|O!j%dO(R%fO~O#t$RO~O!O&RO!]&OO!j&QO%i&UO(R%fO(S!lO(TTO(WUO`)UP~O!v#sO~O%r&WO!Q)QX!])QX(R)QX~O(R&XO~Oj!PO!s&^O%i!QO%k!OO%l!OO%m!OO%p!RO%r!SO%u!TO%v!TO~Od&cOe&bO!v&`O%g&aO%z&_O~P<POd&fOeyOj!PO!]&eO!s&^O!vxO!z]O%g}O%k!OO%l!OO%m!OO%p!RO%r!SO%u!TO%v!TO%x!UO~Ob&iO#^&lO%i&gO(S!lO~P=UO!j&mO!s&qO~O!j#oO~O!]XO~Oa%mO'v&yO'x%mO~Oa%mO'v&|O'x%mO~Oa%mO'v'OO'x%mO~O'u]X!W]Xt]X!i]X&Y]X!]]X%h]X!e]X~P(qO!`']O!a'UO!b'UO(S!lO(TTO(WUO~Oq'SO!Q'RO!Y'VO(c'QO![(gP![(vP~P@]Ol'`O!]'^O(R%fO~Oe'eO!j%dO(R%fO~O!O&RO!j&QO~Oq!nO!Q!oO!z;wO#R!pO#S!pO#U!pO#V!pO(S!lO(TTO(WUO(c!mO(m!sO~O!`'kO!a'jO!b'jO#T!pO#Y'lO#Z'lO~PAwOa%mOh%VO!e#vO!j%dO'x%mO(p'nO~O!n'rO#^'pO~PCVOq!nO!Q!oO(TTO(WUO(c!mO(m!sO~O!]XOq(kX!Q(kX!`(kX!a(kX!b(kX!z(kX#R(kX#S(kX#T(kX#U(kX#V(kX#Y(kX#Z(kX(S(kX(T(kX(W(kX(c(kX(m(kX~O!a'jO!b'jO(S!lO~PCuO'}'vO(O'vO(P'xO~O_!}O(T'zO(U!}O(V'zO~O_#QO(V'zO(W'zO(X#QO~Ot'|O~P%[Ov#SO!S#TO(`#TO(a(PO~O!Y(RO!W'UX!W'[X!Z'UX!Z'[X~P+}O!Z(TO!W(fX~OP$[OR#zO[$cOp$aO!O#yO!Q#{O!Z(TO!j#xO!n$[O#P$RO#l$OO#m$PO#n$PO#o$PO#p$QO#q$RO#r$RO#s$bO#t$RO#u$SO#w$UO#y$WO#z$XO(_VO(p$YO(w#|O(x#}O~O!W(fX~PGpO!W(YO~O!W(sX!Z(sX!e(sX!i(sX(p(sX~O#^(sX#i#bX![(sX~PIsO#^(ZO!W(uX!Z(uX~O!Z([O!W(tX~O!W(_O~O#^$eO~PIsO![(`O~P`OR#zO!O#yO!Q#{O!j#xO(_VOP!la[!lap!la!Z!la!n!la#P!la#l!la#m!la#n!la#o!la#p!la#q!la#r!la#s!la#t!la#u!la#w!la#y!la#z!la(p!la(w!la(x!la~Oa!la'x!la'u!la!W!la!i!lat!la!]!la%h!la!e!la~PKZO!i(aO~O!e#vO#^(bO(p'nO!Z(rXa(rX'x(rX~O!i(rX~PMvO!Q%gO!]%hO!z]O#g(gO#h(fO(R%fO~O!Z(hO!i(qX~O!i(jO~O!Q%gO!]%hO#h(fO(R%fO~OP(eXR(eX[(eXp(eX!O(eX!Q(eX!Z(eX!j(eX!n(eX#P(eX#l(eX#m(eX#n(eX#o(eX#p(eX#q(eX#r(eX#s(eX#t(eX#u(eX#w(eX#y(eX#z(eX(_(eX(p(eX(w(eX(x(eX~O!e#vO!i(eX~P! dOR(lO!O(kO!j#xO#Q$dO!z!ya!Q!ya~O!v!ya%g!ya!]!ya#g!ya#h!ya(R!ya~P!#eO!v(pO~OPYOQYOSfOd!jOe!iOnkOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!]XO!guO!jZO!mYO!nYO!oYO!qvO!s!gO!v!hO$V!kO$miO(R!dO(TTO(WUO(_VO(m[O~Oh%VOn%WOp%XOq$tOr$tOx%YOz%ZO|<eO!Q${O!]$|O!g=vO!j$xO#h<kO$V%_O$s<gO$u<iO$x%`O(R(tO(TTO(WUO(_$uO(w$}O(x%PO~O#i(vO~O!Y(xO!i(iP~P%[O(c(zO(m[O~O!Q(|O!j#xO(c(zO(m[O~OP;vOQ;vOSfOd=rOe!iOnkOp;vOqkOrkOxkOz;vO|;vO!QWO!UkO!VkO!]!eO!g;yO!jZO!m;vO!n;vO!o;vO!q;zO!s;}O!v!hO$V!kO$m=pO(R)ZO(TTO(WUO(_VO(m[O~O!Z$_Oa$pa'x$pa'u$pa!i$pa!W$pa!]$pa%h$pa!e$pa~Oj)bO~P!&iOh%VOn%WOp%XOq$tOr$tOx%YOz%ZO|%[O!Q${O!]$|O!g%aO!j$xO#h%bO$V%_O$s%]O$u%^O$x%`O(R(tO(TTO(WUO(_$uO(w$}O(x%PO~Og(nP~P!+rO!O)gO!e)fO!]$]X$Y$]X$[$]X$^$]X$e$]X~O!e)fO!](yX$Y(yX$[(yX$^(yX$e(yX~O!O)gO~P!-{O!O)gO!](yX$Y(yX$[(yX$^(yX$e(yX~O!])iO$Y)mO$[)hO$^)hO$e)nO~O!Y)qO~P!(yO$[$hO$^$gO$e)uO~Ol$yX!O$yX#Q$yX'w$yX(w$yX(x$yX~OgkXg$yXlkX!ZkX#^kX~P!/qOv)wO(`)xO(a)zO~Ol*TO!O)|O'w)}O(w$}O(x%PO~Og){O~P!0uOg*UO~Oh%VOn%WOp%XOq$tOr$tOx%YOz%ZO|<eO!Q*WO!]*XO!g=vO!j$xO#h<kO$V%_O$s<gO$u<iO$x%`O(TTO(WUO(_$uO(w$}O(x%PO~O!Y*[O(R*VO!i(|P~P!1dO#i*^O~O!j*_O~Oh%VOn%WOp%XOq$tOr$tOx%YOz%ZO|<eO!Q${O!]$|O!g=vO!j$xO#h<kO$V%_O$s<gO$u<iO$x%`O(R*aO(TTO(WUO(_$uO(w$}O(x%PO~O!Y*dO!W(}P~P!3cOp*pOq!nO!Q*fO!`*nO!a*hO!b*hO!j*_O#Y*oO%_*jO(S!lO(TTO(WUO(c!mO~O![*mO~P!5WO#Q$dOl(^X!O(^X'w(^X(w(^X(x(^X!Z(^X#^(^X~Og(^X#}(^X~P!6YOl*uO#^*tOg(]X!Z(]X~O!Z*vOg([X~Oj%cO(R&XOg([P~Oq*yO~O!j+OO~O(R(tO~On+TO!Q%gO!Y#iO!]%hO!z]O#g#lO#h#iO(R%fO!i(qP~O!e#vO#i+UO~O!Q%gO!Y+WO!Z([O!]%hO(R%fO!W(tP~Oq'YO!Q+YO!Y+XO(TTO(WUO(c(zO~O![(vP~P!9]O!Z+ZOa)RX'x)RX~OP$[OR#zO[$cOp$aO!O#yO!Q#{O!j#xO!n$[O#P$RO#l$OO#m$PO#n$PO#o$PO#p$QO#q$RO#r$RO#s$bO#t$RO#u$SO#w$UO#y$WO#z$XO(_VO(p$YO(w#|O(x#}O~Oa!ha!Z!ha'x!ha'u!ha!W!ha!i!hat!ha!]!ha%h!ha!e!ha~P!:TOR#zO!O#yO!Q#{O!j#xO(_VOP!pa[!pap!pa!Z!pa!n!pa#P!pa#l!pa#m!pa#n!pa#o!pa#p!pa#q!pa#r!pa#s!pa#t!pa#u!pa#w!pa#y!pa#z!pa(p!pa(w!pa(x!pa~Oa!pa'x!pa'u!pa!W!pa!i!pat!pa!]!pa%h!pa!e!pa~P!<kOR#zO!O#yO!Q#{O!j#xO(_VOP!ra[!rap!ra!Z!ra!n!ra#P!ra#l!ra#m!ra#n!ra#o!ra#p!ra#q!ra#r!ra#s!ra#t!ra#u!ra#w!ra#y!ra#z!ra(p!ra(w!ra(x!ra~Oa!ra'x!ra'u!ra!W!ra!i!rat!ra!]!ra%h!ra!e!ra~P!?ROh%VOl+dO!]'^O%h+cO~O!e+fOa(ZX!](ZX'x(ZX!Z(ZX~Oa%mO!]XO'x%mO~Oh%VO!j%dO~Oh%VO!j%dO(R%fO~O!e#vO#i(vO~Ob+qO%i+rO(R+nO(TTO(WUO![)VP~O!Z+sO`)UX~O[+wO~O`+xO~O!]&OO(R%fO(S!lO`)UP~Oh%VO#^+}O~Oh%VOl,QO!]$|O~O!],SO~O!O,UO!]XO~O%m%uO~O!v,ZO~Oe,`O~Ob,aO(R#nO(TTO(WUO![)TP~Oe%|O~O%i!QO(R&XO~P=UO[,fO`,eO~OPYOQYOSfOdzOeyOnkOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!guO!jZO!mYO!nYO!oYO!qvO!vxO!z]O$miO%g}O(TTO(WUO(_VO(m[O~O!]!eO!s!gO$V!kO(R!dO~P!FRO`,eOa%mO'x%mO~OPYOQYOSfOd!jOe!iOnkOpYOqkOrkOxkOzYO|YO!QWO!UkO!VkO!]!eO!guO!jZO!mYO!nYO!oYO!qvO!v!hO$V!kO$miO(R!dO(TTO(WUO(_VO(m[O~Oa,kOj!OO!swO%k!OO%l!OO%m!OO~P!HkO!j&mO~O&[,qO~O!],sO~O&m,uO&o,vOP&jaQ&jaS&jaY&jaa&jad&jae&jaj&jan&jap&jaq&jar&jax&jaz&ja|&ja!Q&ja!U&ja!V&ja!]&ja!g&ja!j&ja!m&ja!n&ja!o&ja!q&ja!s&ja!v&ja!z&ja$V&ja$m&ja%g&ja%i&ja%k&ja%l&ja%m&ja%p&ja%r&ja%u&ja%v&ja%x&ja&U&ja&[&ja&^&ja&`&ja&b&ja&e&ja&k&ja&q&ja&s&ja&u&ja&w&ja&y&ja'u&ja(R&ja(T&ja(W&ja(_&ja(m&ja![&ja&c&jab&ja&h&ja~O(R,{O~Oh!cX!Z!PX![!PX!e!PX!e!cX!j!cX#^!PX~O!Z!cX![!cX~P# qO!e-QO#^-POh(hX!Z#fX![#fX!e(hX!j(hX~O!Z(hX![(hX~P#!dOh%VO!e-SO!j%dO!Z!_X![!_X~Oq!nO!Q!oO(TTO(WUO(c!mO~OP;vOQ;vOSfOd=rOe!iOnkOp;vOqkOrkOxkOz;vO|;vO!QWO!UkO!VkO!]!eO!g;yO!jZO!m;vO!n;vO!o;vO!q;zO!s;}O!v!hO$V!kO$m=pO(TTO(WUO(_VO(m[O~O(R<rO~P##yO!Z-WO![(gX~O![-YO~O!e-QO#^-PO!Z#fX![#fX~O!Z-ZO![(vX~O![-]O~O!a-^O!b-^O(S!lO~P##hO![-aO~P'_Ol-dO!]'^O~O!W-iO~Oq!ya!`!ya!a!ya!b!ya#R!ya#S!ya#T!ya#U!ya#V!ya#Y!ya#Z!ya(S!ya(T!ya(W!ya(c!ya(m!ya~P!#eO!n-nO#^-lO~PCVO!a-pO!b-pO(S!lO~PCuOa%mO#^-lO'x%mO~Oa%mO!e#vO#^-lO'x%mO~Oa%mO!e#vO!n-nO#^-lO'x%mO(p'nO~O'}'vO(O'vO(P-uO~Ot-vO~O!W'Ua!Z'Ua~P!:TO!Y-zO!W'UX!Z'UX~P%[O!Z(TO!W(fa~O!W(fa~PGpO!Z([O!W(ta~O!Q%gO!Y.OO!]%hO(R%fO!W'[X!Z'[X~O#^.QO!Z(ra!i(raa(ra'x(ra~O!e#vO~P#,PO!Z(hO!i(qa~O!Q%gO!]%hO#h.UO(R%fO~On.ZO!Q%gO!Y.WO!]%hO!z]O#g.YO#h.WO(R%fO!Z'_X!i'_X~OR._O!j#xO~Oh%VOl.bO!]'^O%h.aO~Oa#ai!Z#ai'x#ai'u#ai!W#ai!i#ait#ai!]#ai%h#ai!e#ai~P!:TOl=|O!O)|O'w)}O(w$}O(x%PO~O#i#]aa#]a#^#]a'x#]a!Z#]a!i#]a!]#]a!W#]a~P#.{O#i(^XP(^XR(^X[(^Xa(^Xp(^X!Q(^X!j(^X!n(^X#P(^X#l(^X#m(^X#n(^X#o(^X#p(^X#q(^X#r(^X#s(^X#t(^X#u(^X#w(^X#y(^X#z(^X'x(^X(_(^X(p(^X!i(^X!W(^X'u(^Xt(^X!](^X%h(^X!e(^X~P!6YO!Z.oO!i(iX~P!:TO!i.rO~O!W.tO~OP$[OR#zO!O#yO!Q#{O!j#xO!n$[O(_VO[#kia#kip#ki!Z#ki#P#ki#m#ki#n#ki#o#ki#p#ki#q#ki#r#ki#s#ki#t#ki#u#ki#w#ki#y#ki#z#ki'x#ki(p#ki(w#ki(x#ki'u#ki!W#ki!i#kit#ki!]#ki%h#ki!e#ki~O#l#ki~P#2kO#l$OO~P#2kOP$[OR#zOp$aO!O#yO!Q#{O!j#xO!n$[O#l$OO#m$PO#n$PO#o$PO(_VO[#kia#ki!Z#ki#P#ki#q#ki#r#ki#s#ki#t#ki#u#ki#w#ki#y#ki#z#ki'x#ki(p#ki(w#ki(x#ki'u#ki!W#ki!i#kit#ki!]#ki%h#ki!e#ki~O#p#ki~P#5YO#p$QO~P#5YOP$[OR#zO[$cOp$aO!O#yO!Q#{O!j#xO!n$[O#P$RO#l$OO#m$PO#n$PO#o$PO#p$QO#q$RO#r$RO#s$bO#t$RO(_VOa#ki!Z#ki#w#ki#y#ki#z#ki'x#ki(p#ki(w#ki(x#ki'u#ki!W#ki!i#kit#ki!]#ki%h#ki!e#ki~O#u#ki~P#7wOP$[OR#zO[$cOp$aO!O#yO!Q#{O!j#xO!n$[O#P$RO#l$OO#m$PO#n$PO#o$PO#p$QO#q$RO#r$RO#s$bO#t$RO#u$SO(_VO(x#}Oa#ki!Z#ki#y#ki#z#ki'x#ki(p#ki(w#ki'u#ki!W#ki!i#kit#ki!]#ki%h#ki!e#ki~O#w$UO~P#:_O#w#ki~P#:_O#u$SO~P#7wOP$[OR#zO[$cOp$aO!O#yO!Q#{O!j#xO!n$[O#P$RO#l$OO#m$PO#n$PO#o$PO#p$QO#q$RO#r$RO#s$bO#t$RO#u$SO#w$UO(_VO(w#|O(x#}Oa#ki!Z#ki#z#ki'x#ki(p#ki'u#ki!W#ki!i#kit#ki!]#ki%h#ki!e#ki~O#y#ki~P#=TO#y$WO~P#=TOP]XR]X[]Xp]X!O]X!Q]X!j]X!n]X#P]X#Q]X#^]X#ifX#l]X#m]X#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#w]X#y]X#z]X$P]X(_]X(p]X(w]X(x]X!Z]X![]X~O#}]X~P#?rOP$[OR#zO[<_Op<]O!O#yO!Q#{O!j#xO!n$[O#P<SO#l<PO#m<QO#n<QO#o<QO#p<RO#q<SO#r<SO#s<^O#t<SO#u<TO#w<VO#y<XO#z<YO(_VO(p$YO(w#|O(x#}O~O#}.vO~P#BPO#Q$dO#^<`O$P<`O#}(eX![(eX~P! dOa'ba!Z'ba'x'ba'u'ba!i'ba!W'bat'ba!]'ba%h'ba!e'ba~P!:TO[#kia#kip#ki!Z#ki#P#ki#p#ki#q#ki#r#ki#s#ki#t#ki#u#ki#w#ki#y#ki#z#ki'x#ki(p#ki'u#ki!W#ki!i#kit#ki!]#ki%h#ki!e#ki~OP$[OR#zO!O#yO!Q#{O!j#xO!n$[O#l$OO#m$PO#n$PO#o$PO(_VO(w#ki(x#ki~P#EROl=|O!O)|O'w)}O(w$}O(x%POP#kiR#ki!Q#ki!j#ki!n#ki#l#ki#m#ki#n#ki#o#ki(_#ki~P#ERO!Z.zOg(nX~P!0uOg.|O~Oa$Oi!Z$Oi'x$Oi'u$Oi!W$Oi!i$Oit$Oi!]$Oi%h$Oi!e$Oi~P!:TO$[.}O$^.}O~O$[/OO$^/OO~O!e)fO#^/PO!]$bX$Y$bX$[$bX$^$bX$e$bX~O!Y/QO~O!])iO$Y/SO$[)hO$^)hO$e/TO~O!Z<ZO![(dX~P#BPO![/UO~O!e)fO$e(yX~O$e/WO~Ot/XO~P!&iOv)wO(`)xO(a/[O~O!Q/_O~O(w$}Ol%`a!O%`a'w%`a(x%`a!Z%`a#^%`a~Og%`a#}%`a~P#LTO(x%POl%ba!O%ba'w%ba(w%ba!Z%ba#^%ba~Og%ba#}%ba~P#LvO!ZfX!efX!ifX!i$yX(pfX~P!/qO!Y/hO!Z([O(R/gO!W(tP!W(}P~P!1dOp*pO!`*nO!a*hO!b*hO!j*_O#Y*oO%_*jO(S!lO(TTO(WUO~Oq<oO!Q/iO!Y+XO![*mO(c<nO![(vP~P#NaO!i/jO~P#.{O!Z/kO!e#vO(p'nO!i(|X~O!i/pO~O!Q%gO!Y*[O!]%hO(R%fO!i(|P~O#i/rO~O!W$yX!Z$yX!e%QX~P!/qO!Z/sO!W(}X~P#.{O!e/uO~O!W/wO~OnkO(R/xO~P.iOh%VOp/}O!e#vO!j%dO(p'nO~O!e+fO~Oa%mO!Z0RO'x%mO~O![0TO~P!5WO!a0UO!b0UO(S!lO~P##hOq!nO!Q0VO(TTO(WUO(c!mO~O#Y0XO~Og%`a!Z%`a#^%`a#}%`a~P!0uOg%ba!Z%ba#^%ba#}%ba~P!0uOj%cO(R&XOg'kX!Z'kX~O!Z*vOg([a~Og0bO~OR0cO!O0cO!Q0dO#Q$dOl{a'w{a(w{a(x{a!Z{a#^{a~Og{a#}{a~P$&dO!O)|O'w)}Ol$ra(w$ra(x$ra!Z$ra#^$ra~Og$ra#}$ra~P$'`O!O)|O'w)}Ol$ta(w$ta(x$ta!Z$ta#^$ta~Og$ta#}$ta~P$(RO#i0gO~Og%Sa!Z%Sa#^%Sa#}%Sa~P!0uOl0iO#^0hOg(]a!Z(]a~O!e#vO~O#i0lO~O!Z+ZOa)Ra'x)Ra~OR#zO!O#yO!Q#{O!j#xO(_VOP!pi[!pip!pi!Z!pi!n!pi#P!pi#l!pi#m!pi#n!pi#o!pi#p!pi#q!pi#r!pi#s!pi#t!pi#u!pi#w!pi#y!pi#z!pi(p!pi(w!pi(x!pi~Oa!pi'x!pi'u!pi!W!pi!i!pit!pi!]!pi%h!pi!e!pi~P$*OOh%VOp%XOq$tOr$tOx%YOz%ZO|<eO!Q${O!]$|O!g=vO!j$xO#h<kO$V%_O$s<gO$u<iO$x%`O(TTO(WUO(_$uO(w$}O(x%PO~On0vO%[0wO(R0tO~P$,fO!e+fOa(Za!](Za'x(Za!Z(Za~O#i0|O~O[]X!ZfX![fX~O!Z0}O![)VX~O![1PO~O[1QO~Ob1SO(R+nO(TTO(WUO~O!]&OO(R%fO`'sX!Z'sX~O!Z+sO`)Ua~O!i1VO~P!:TO[1YO~O`1ZO~O#^1^O~Ol1aO!]$|O~O(c(zO![)SP~Oh%VOl1jO!]1gO%h1iO~O[1tO!Z1rO![)TX~O![1uO~O`1wOa%mO'x%mO~O(R#nO(TTO(WUO~O#Q$dO#^$eO$P$eOP(eXR(eX[(eXp(eX!O(eX!Q(eX!Z(eX!j(eX!n(eX#P(eX#l(eX#m(eX#n(eX#o(eX#p(eX#q(eX#r(eX#s(eX#u(eX#w(eX#y(eX#z(eX(_(eX(p(eX(w(eX(x(eX~O#t1zO&Y1{Oa(eX~P$2PO#^$eO#t1zO&Y1{O~Oa1}O~P%[Oa2PO~O&c2SOP&aiQ&aiS&aiY&aia&aid&aie&aij&ain&aip&aiq&air&aix&aiz&ai|&ai!Q&ai!U&ai!V&ai!]&ai!g&ai!j&ai!m&ai!n&ai!o&ai!q&ai!s&ai!v&ai!z&ai$V&ai$m&ai%g&ai%i&ai%k&ai%l&ai%m&ai%p&ai%r&ai%u&ai%v&ai%x&ai&U&ai&[&ai&^&ai&`&ai&b&ai&e&ai&k&ai&q&ai&s&ai&u&ai&w&ai&y&ai'u&ai(R&ai(T&ai(W&ai(_&ai(m&ai![&aib&ai&h&ai~Ob2YO![2WO&h2XO~P`O!]XO!j2[O~O&o,vOP&jiQ&jiS&jiY&jia&jid&jie&jij&jin&jip&jiq&jir&jix&jiz&ji|&ji!Q&ji!U&ji!V&ji!]&ji!g&ji!j&ji!m&ji!n&ji!o&ji!q&ji!s&ji!v&ji!z&ji$V&ji$m&ji%g&ji%i&ji%k&ji%l&ji%m&ji%p&ji%r&ji%u&ji%v&ji%x&ji&U&ji&[&ji&^&ji&`&ji&b&ji&e&ji&k&ji&q&ji&s&ji&u&ji&w&ji&y&ji'u&ji(R&ji(T&ji(W&ji(_&ji(m&ji![&ji&c&jib&ji&h&ji~O!W2bO~O!Z!_a![!_a~P#BPOq!nO!Q!oO!Y2hO(c!mO!Z'VX!['VX~P@]O!Z-WO![(ga~O!Z']X![']X~P!9]O!Z-ZO![(va~O![2oO~P'_Oa%mO#^2xO'x%mO~Oa%mO!e#vO#^2xO'x%mO~Oa%mO!e#vO!n2|O#^2xO'x%mO(p'nO~Oa%mO'x%mO~P!:TO!Z$_Ot$pa~O!W'Ui!Z'Ui~P!:TO!Z(TO!W(fi~O!Z([O!W(ti~O!W(ui!Z(ui~P!:TO!Z(ri!i(ria(ri'x(ri~P!:TO#^3OO!Z(ri!i(ria(ri'x(ri~O!Z(hO!i(qi~O!Q%gO!]%hO!z]O#g3TO#h3SO(R%fO~O!Q%gO!]%hO#h3SO(R%fO~Ol3[O!]'^O%h3ZO~Oh%VOl3[O!]'^O%h3ZO~O#i%`aP%`aR%`a[%`aa%`ap%`a!Q%`a!j%`a!n%`a#P%`a#l%`a#m%`a#n%`a#o%`a#p%`a#q%`a#r%`a#s%`a#t%`a#u%`a#w%`a#y%`a#z%`a'x%`a(_%`a(p%`a!i%`a!W%`a'u%`at%`a!]%`a%h%`a!e%`a~P#LTO#i%baP%baR%ba[%baa%bap%ba!Q%ba!j%ba!n%ba#P%ba#l%ba#m%ba#n%ba#o%ba#p%ba#q%ba#r%ba#s%ba#t%ba#u%ba#w%ba#y%ba#z%ba'x%ba(_%ba(p%ba!i%ba!W%ba'u%bat%ba!]%ba%h%ba!e%ba~P#LvO#i%`aP%`aR%`a[%`aa%`ap%`a!Q%`a!Z%`a!j%`a!n%`a#P%`a#l%`a#m%`a#n%`a#o%`a#p%`a#q%`a#r%`a#s%`a#t%`a#u%`a#w%`a#y%`a#z%`a'x%`a(_%`a(p%`a!i%`a!W%`a'u%`a#^%`at%`a!]%`a%h%`a!e%`a~P#.{O#i%baP%baR%ba[%baa%bap%ba!Q%ba!Z%ba!j%ba!n%ba#P%ba#l%ba#m%ba#n%ba#o%ba#p%ba#q%ba#r%ba#s%ba#t%ba#u%ba#w%ba#y%ba#z%ba'x%ba(_%ba(p%ba!i%ba!W%ba'u%ba#^%bat%ba!]%ba%h%ba!e%ba~P#.{O#i{aP{a[{aa{ap{a!j{a!n{a#P{a#l{a#m{a#n{a#o{a#p{a#q{a#r{a#s{a#t{a#u{a#w{a#y{a#z{a'x{a(_{a(p{a!i{a!W{a'u{at{a!]{a%h{a!e{a~P$&dO#i$raP$raR$ra[$raa$rap$ra!Q$ra!j$ra!n$ra#P$ra#l$ra#m$ra#n$ra#o$ra#p$ra#q$ra#r$ra#s$ra#t$ra#u$ra#w$ra#y$ra#z$ra'x$ra(_$ra(p$ra!i$ra!W$ra'u$rat$ra!]$ra%h$ra!e$ra~P$'`O#i$taP$taR$ta[$taa$tap$ta!Q$ta!j$ta!n$ta#P$ta#l$ta#m$ta#n$ta#o$ta#p$ta#q$ta#r$ta#s$ta#t$ta#u$ta#w$ta#y$ta#z$ta'x$ta(_$ta(p$ta!i$ta!W$ta'u$tat$ta!]$ta%h$ta!e$ta~P$(RO#i%SaP%SaR%Sa[%Saa%Sap%Sa!Q%Sa!Z%Sa!j%Sa!n%Sa#P%Sa#l%Sa#m%Sa#n%Sa#o%Sa#p%Sa#q%Sa#r%Sa#s%Sa#t%Sa#u%Sa#w%Sa#y%Sa#z%Sa'x%Sa(_%Sa(p%Sa!i%Sa!W%Sa'u%Sa#^%Sat%Sa!]%Sa%h%Sa!e%Sa~P#.{Oa#aq!Z#aq'x#aq'u#aq!W#aq!i#aqt#aq!]#aq%h#aq!e#aq~P!:TO!Y3dO!Z'WX!i'WX~P%[O!Z.oO!i(ia~O!Z.oO!i(ia~P!:TO!W3gO~O#}!la![!la~PKZO#}!ha!Z!ha![!ha~P#BPO#}!pa![!pa~P!<kO#}!ra![!ra~P!?ROg'ZX!Z'ZX~P!+rO!Z.zOg(na~OSfO!]3{O$c3|O~O![4QO~Ot4RO~P#.{Oa$lq!Z$lq'x$lq'u$lq!W$lq!i$lqt$lq!]$lq%h$lq!e$lq~P!:TO!W4TO~P!&iO!Q4UO~O!O)|O'w)}O(x%POl'ga(w'ga!Z'ga#^'ga~Og'ga#}'ga~P%+uO!O)|O'w)}Ol'ia(w'ia(x'ia!Z'ia#^'ia~Og'ia#}'ia~P%,hO(p$YO~P#.{O!WfX!W$yX!ZfX!Z$yX!e%QX#^fX~P!/qO(R<xO~P!1dO!Q%gO!Y4XO!]%hO(R%fO!Z'cX!i'cX~O!Z/kO!i(|a~O!Z/kO!e#vO!i(|a~O!Z/kO!e#vO(p'nO!i(|a~Og${i!Z${i#^${i#}${i~P!0uO!Y4aO!W'eX!Z'eX~P!3cO!Z/sO!W(}a~O!Z/sO!W(}a~P#.{OP]XR]X[]Xp]X!O]X!Q]X!W]X!Z]X!j]X!n]X#P]X#Q]X#^]X#ifX#l]X#m]X#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#w]X#y]X#z]X$P]X(_]X(p]X(w]X(x]X~O!e%XX#t%XX~P%0XO!e#vO#t4fO~Oh%VO!e#vO!j%dO~Oh%VOp4kO!j%dO(p'nO~Op4pO!e#vO(p'nO~Oq!nO!Q4qO(TTO(WUO(c!mO~O(w$}Ol%`i!O%`i'w%`i(x%`i!Z%`i#^%`i~Og%`i#}%`i~P%3xO(x%POl%bi!O%bi'w%bi(w%bi!Z%bi#^%bi~Og%bi#}%bi~P%4kOg(]i!Z(]i~P!0uO#^4wOg(]i!Z(]i~P!0uO!i4zO~Oa$nq!Z$nq'x$nq'u$nq!W$nq!i$nqt$nq!]$nq%h$nq!e$nq~P!:TO!W5QO~O!Z5RO!])OX~P#.{Oa]Xa$yX!]]X!]$yX%]]X'x]X'x$yX!Z]X!Z$yX~P!/qO%]5UOa%Za!]%Za'x%Za!Z%Za~OlmX!OmX'wmX(wmX(xmX~P%7nOn5VO(R#nO~Ob5]O%i5^O(R+nO(TTO(WUO!Z'rX!['rX~O!Z0}O![)Va~O[5bO~O`5cO~Oa%mO'x%mO~P#.{O!Z5kO#^5mO![)SX~O![5nO~Op5tOq!nO!Q*fO!`!yO!a!vO!b!vO!z;wO#R!pO#S!pO#T!pO#U!pO#V!pO#Y5sO#Z!zO(S!lO(TTO(WUO(c!mO(m!sO~O![5rO~P%:ROl5yO!]1gO%h5xO~Oh%VOl5yO!]1gO%h5xO~Ob6QO(R#nO(TTO(WUO!Z'qX!['qX~O!Z1rO![)Ta~O(TTO(WUO(c6SO~O`6WO~O#t6ZO&Y6[O~PMvO!i6]O~P%[Oa6_O~Oa6_O~P%[Ob2YO![6dO&h2XO~P`O!e6fO~O!e6hOh(hi!Z(hi![(hi!e(hi!j(hip(hi(p(hi~O!Z#fi![#fi~P#BPO#^6iO!Z#fi![#fi~O!Z!_i![!_i~P#BPOa%mO#^6rO'x%mO~Oa%mO!e#vO#^6rO'x%mO~O!Z(rq!i(rqa(rq'x(rq~P!:TO!Z(hO!i(qq~O!Q%gO!]%hO#h6yO(R%fO~O!]'^O%h6|O~Ol7QO!]'^O%h6|O~O#i'gaP'gaR'ga['gaa'gap'ga!Q'ga!j'ga!n'ga#P'ga#l'ga#m'ga#n'ga#o'ga#p'ga#q'ga#r'ga#s'ga#t'ga#u'ga#w'ga#y'ga#z'ga'x'ga(_'ga(p'ga!i'ga!W'ga'u'gat'ga!]'ga%h'ga!e'ga~P%+uO#i'iaP'iaR'ia['iaa'iap'ia!Q'ia!j'ia!n'ia#P'ia#l'ia#m'ia#n'ia#o'ia#p'ia#q'ia#r'ia#s'ia#t'ia#u'ia#w'ia#y'ia#z'ia'x'ia(_'ia(p'ia!i'ia!W'ia'u'iat'ia!]'ia%h'ia!e'ia~P%,hO#i${iP${iR${i[${ia${ip${i!Q${i!Z${i!j${i!n${i#P${i#l${i#m${i#n${i#o${i#p${i#q${i#r${i#s${i#t${i#u${i#w${i#y${i#z${i'x${i(_${i(p${i!i${i!W${i'u${i#^${it${i!]${i%h${i!e${i~P#.{O#i%`iP%`iR%`i[%`ia%`ip%`i!Q%`i!j%`i!n%`i#P%`i#l%`i#m%`i#n%`i#o%`i#p%`i#q%`i#r%`i#s%`i#t%`i#u%`i#w%`i#y%`i#z%`i'x%`i(_%`i(p%`i!i%`i!W%`i'u%`it%`i!]%`i%h%`i!e%`i~P%3xO#i%biP%biR%bi[%bia%bip%bi!Q%bi!j%bi!n%bi#P%bi#l%bi#m%bi#n%bi#o%bi#p%bi#q%bi#r%bi#s%bi#t%bi#u%bi#w%bi#y%bi#z%bi'x%bi(_%bi(p%bi!i%bi!W%bi'u%bit%bi!]%bi%h%bi!e%bi~P%4kO!Z'Wa!i'Wa~P!:TO!Z.oO!i(ii~O#}#ai!Z#ai![#ai~P#BPOP$[OR#zO!O#yO!Q#{O!j#xO!n$[O(_VO[#kip#ki#P#ki#m#ki#n#ki#o#ki#p#ki#q#ki#r#ki#s#ki#t#ki#u#ki#w#ki#y#ki#z#ki#}#ki(p#ki(w#ki(x#ki!Z#ki![#ki~O#l#ki~P%MQO#l<PO~P%MQOP$[OR#zOp<]O!O#yO!Q#{O!j#xO!n$[O#l<PO#m<QO#n<QO#o<QO(_VO[#ki#P#ki#q#ki#r#ki#s#ki#t#ki#u#ki#w#ki#y#ki#z#ki#}#ki(p#ki(w#ki(x#ki!Z#ki![#ki~O#p#ki~P& YO#p<RO~P& YOP$[OR#zO[<_Op<]O!O#yO!Q#{O!j#xO!n$[O#P<SO#l<PO#m<QO#n<QO#o<QO#p<RO#q<SO#r<SO#s<^O#t<SO(_VO#w#ki#y#ki#z#ki#}#ki(p#ki(w#ki(x#ki!Z#ki![#ki~O#u#ki~P&#bOP$[OR#zO[<_Op<]O!O#yO!Q#{O!j#xO!n$[O#P<SO#l<PO#m<QO#n<QO#o<QO#p<RO#q<SO#r<SO#s<^O#t<SO#u<TO(_VO(x#}O#y#ki#z#ki#}#ki(p#ki(w#ki!Z#ki![#ki~O#w<VO~P&%cO#w#ki~P&%cO#u<TO~P&#bOP$[OR#zO[<_Op<]O!O#yO!Q#{O!j#xO!n$[O#P<SO#l<PO#m<QO#n<QO#o<QO#p<RO#q<SO#r<SO#s<^O#t<SO#u<TO#w<VO(_VO(w#|O(x#}O#z#ki#}#ki(p#ki!Z#ki![#ki~O#y#ki~P&'rO#y<XO~P&'rOa#{y!Z#{y'x#{y'u#{y!W#{y!i#{yt#{y!]#{y%h#{y!e#{y~P!:TO[#kip#ki#P#ki#p#ki#q#ki#r#ki#s#ki#t#ki#u#ki#w#ki#y#ki#z#ki#}#ki(p#ki!Z#ki![#ki~OP$[OR#zO!O#yO!Q#{O!j#xO!n$[O#l<PO#m<QO#n<QO#o<QO(_VO(w#ki(x#ki~P&*nOl=}O!O)|O'w)}O(w$}O(x%POP#kiR#ki!Q#ki!j#ki!n#ki#l#ki#m#ki#n#ki#o#ki(_#ki~P&*nO#Q$dOP(^XR(^X[(^Xl(^Xp(^X!O(^X!Q(^X!j(^X!n(^X#P(^X#l(^X#m(^X#n(^X#o(^X#p(^X#q(^X#r(^X#s(^X#t(^X#u(^X#w(^X#y(^X#z(^X#}(^X'w(^X(_(^X(p(^X(w(^X(x(^X!Z(^X![(^X~O#}$Oi!Z$Oi![$Oi~P#BPO#}!pi![!pi~P$*OOg'Za!Z'Za~P!0uO![7dO~O!Z'ba!['ba~P#BPO!W7eO~P#.{O!e#vO(p'nO!Z'ca!i'ca~O!Z/kO!i(|i~O!Z/kO!e#vO!i(|i~Og${q!Z${q#^${q#}${q~P!0uO!W'ea!Z'ea~P#.{O!e7lO~O!Z/sO!W(}i~P#.{O!Z/sO!W(}i~O!W7oO~Oh%VOp7tO!j%dO(p'nO~O!e#vO#t7vO~Op7yO!e#vO(p'nO~O!O)|O'w)}O(x%POl'ha(w'ha!Z'ha#^'ha~Og'ha#}'ha~P&3oO!O)|O'w)}Ol'ja(w'ja(x'ja!Z'ja#^'ja~Og'ja#}'ja~P&4bO!W7{O~Og$}q!Z$}q#^$}q#}$}q~P!0uOg(]q!Z(]q~P!0uO#^7|Og(]q!Z(]q~P!0uOa$ny!Z$ny'x$ny'u$ny!W$ny!i$nyt$ny!]$ny%h$ny!e$ny~P!:TO!e6hO~O!Z5RO!])Oa~O!]'^OP$SaR$Sa[$Sap$Sa!O$Sa!Q$Sa!Z$Sa!j$Sa!n$Sa#P$Sa#l$Sa#m$Sa#n$Sa#o$Sa#p$Sa#q$Sa#r$Sa#s$Sa#t$Sa#u$Sa#w$Sa#y$Sa#z$Sa(_$Sa(p$Sa(w$Sa(x$Sa~O%h6|O~P&7SO%]8QOa%Zi!]%Zi'x%Zi!Z%Zi~Oa#ay!Z#ay'x#ay'u#ay!W#ay!i#ayt#ay!]#ay%h#ay!e#ay~P!:TO[8SO~Ob8UO(R+nO(TTO(WUO~O!Z0}O![)Vi~O`8YO~O(c(zO!Z'nX!['nX~O!Z5kO![)Sa~O![8cO~P%:RO(m!sO~P$$oO#Y8dO~O!]1gO~O!]1gO%h8fO~Ol8iO!]1gO%h8fO~O[8nO!Z'qa!['qa~O!Z1rO![)Ti~O!i8rO~O!i8sO~O!i8vO~O!i8vO~P%[Oa8xO~O!e8yO~O!i8zO~O!Z(ui![(ui~P#BPOa%mO#^9SO'x%mO~O!Z(ry!i(rya(ry'x(ry~P!:TO!Z(hO!i(qy~O%h9VO~P&7SO!]'^O%h9VO~O#i${qP${qR${q[${qa${qp${q!Q${q!Z${q!j${q!n${q#P${q#l${q#m${q#n${q#o${q#p${q#q${q#r${q#s${q#t${q#u${q#w${q#y${q#z${q'x${q(_${q(p${q!i${q!W${q'u${q#^${qt${q!]${q%h${q!e${q~P#.{O#i'haP'haR'ha['haa'hap'ha!Q'ha!j'ha!n'ha#P'ha#l'ha#m'ha#n'ha#o'ha#p'ha#q'ha#r'ha#s'ha#t'ha#u'ha#w'ha#y'ha#z'ha'x'ha(_'ha(p'ha!i'ha!W'ha'u'hat'ha!]'ha%h'ha!e'ha~P&3oO#i'jaP'jaR'ja['jaa'jap'ja!Q'ja!j'ja!n'ja#P'ja#l'ja#m'ja#n'ja#o'ja#p'ja#q'ja#r'ja#s'ja#t'ja#u'ja#w'ja#y'ja#z'ja'x'ja(_'ja(p'ja!i'ja!W'ja'u'jat'ja!]'ja%h'ja!e'ja~P&4bO#i$}qP$}qR$}q[$}qa$}qp$}q!Q$}q!Z$}q!j$}q!n$}q#P$}q#l$}q#m$}q#n$}q#o$}q#p$}q#q$}q#r$}q#s$}q#t$}q#u$}q#w$}q#y$}q#z$}q'x$}q(_$}q(p$}q!i$}q!W$}q'u$}q#^$}qt$}q!]$}q%h$}q!e$}q~P#.{O!Z'Wi!i'Wi~P!:TO#}#aq!Z#aq![#aq~P#BPO(w$}OP%`aR%`a[%`ap%`a!Q%`a!j%`a!n%`a#P%`a#l%`a#m%`a#n%`a#o%`a#p%`a#q%`a#r%`a#s%`a#t%`a#u%`a#w%`a#y%`a#z%`a#}%`a(_%`a(p%`a!Z%`a![%`a~Ol%`a!O%`a'w%`a(x%`a~P&HgO(x%POP%baR%ba[%bap%ba!Q%ba!j%ba!n%ba#P%ba#l%ba#m%ba#n%ba#o%ba#p%ba#q%ba#r%ba#s%ba#t%ba#u%ba#w%ba#y%ba#z%ba#}%ba(_%ba(p%ba!Z%ba![%ba~Ol%ba!O%ba'w%ba(w%ba~P&JnOl=}O!O)|O'w)}O(x%PO~P&HgOl=}O!O)|O'w)}O(w$}O~P&JnOR0cO!O0cO!Q0dO#Q$dOP{a[{al{ap{a!j{a!n{a#P{a#l{a#m{a#n{a#o{a#p{a#q{a#r{a#s{a#t{a#u{a#w{a#y{a#z{a#}{a'w{a(_{a(p{a(w{a(x{a!Z{a![{a~O!O)|O'w)}OP$raR$ra[$ral$rap$ra!Q$ra!j$ra!n$ra#P$ra#l$ra#m$ra#n$ra#o$ra#p$ra#q$ra#r$ra#s$ra#t$ra#u$ra#w$ra#y$ra#z$ra#}$ra(_$ra(p$ra(w$ra(x$ra!Z$ra![$ra~O!O)|O'w)}OP$taR$ta[$tal$tap$ta!Q$ta!j$ta!n$ta#P$ta#l$ta#m$ta#n$ta#o$ta#p$ta#q$ta#r$ta#s$ta#t$ta#u$ta#w$ta#y$ta#z$ta#}$ta(_$ta(p$ta(w$ta(x$ta!Z$ta![$ta~Ol=}O!O)|O'w)}O(w$}O(x%PO~OP%SaR%Sa[%Sap%Sa!Q%Sa!j%Sa!n%Sa#P%Sa#l%Sa#m%Sa#n%Sa#o%Sa#p%Sa#q%Sa#r%Sa#s%Sa#t%Sa#u%Sa#w%Sa#y%Sa#z%Sa#}%Sa(_%Sa(p%Sa!Z%Sa![%Sa~P'%sO#}$lq!Z$lq![$lq~P#BPO#}$nq!Z$nq![$nq~P#BPO![9dO~O#}9eO~P!0uO!e#vO!Z'ci!i'ci~O!e#vO(p'nO!Z'ci!i'ci~O!Z/kO!i(|q~O!W'ei!Z'ei~P#.{O!Z/sO!W(}q~Op9lO!e#vO(p'nO~O[9nO!W9mO~P#.{O!W9mO~O!e#vO#t9tO~Og(]y!Z(]y~P!0uO!Z'la!]'la~P#.{Oa%Zq!]%Zq'x%Zq!Z%Zq~P#.{O[9yO~O!Z0}O![)Vq~O#^9}O!Z'na!['na~O!Z5kO![)Si~P#BPO!Q:PO~O!]1gO%h:SO~O(TTO(WUO(c:XO~O!Z1rO![)Tq~O!i:[O~O!i:]O~O!i:^O~O!i:^O~P%[O#^:aO!Z#fy![#fy~O!Z#fy![#fy~P#BPO%h:fO~P&7SO!]'^O%h:fO~O#}#{y!Z#{y![#{y~P#BPOP${iR${i[${ip${i!Q${i!j${i!n${i#P${i#l${i#m${i#n${i#o${i#p${i#q${i#r${i#s${i#t${i#u${i#w${i#y${i#z${i#}${i(_${i(p${i!Z${i![${i~P'%sO!O)|O'w)}O(x%POP'gaR'ga['gal'gap'ga!Q'ga!j'ga!n'ga#P'ga#l'ga#m'ga#n'ga#o'ga#p'ga#q'ga#r'ga#s'ga#t'ga#u'ga#w'ga#y'ga#z'ga#}'ga(_'ga(p'ga(w'ga!Z'ga!['ga~O!O)|O'w)}OP'iaR'ia['ial'iap'ia!Q'ia!j'ia!n'ia#P'ia#l'ia#m'ia#n'ia#o'ia#p'ia#q'ia#r'ia#s'ia#t'ia#u'ia#w'ia#y'ia#z'ia#}'ia(_'ia(p'ia(w'ia(x'ia!Z'ia!['ia~O(w$}OP%`iR%`i[%`il%`ip%`i!O%`i!Q%`i!j%`i!n%`i#P%`i#l%`i#m%`i#n%`i#o%`i#p%`i#q%`i#r%`i#s%`i#t%`i#u%`i#w%`i#y%`i#z%`i#}%`i'w%`i(_%`i(p%`i(x%`i!Z%`i![%`i~O(x%POP%biR%bi[%bil%bip%bi!O%bi!Q%bi!j%bi!n%bi#P%bi#l%bi#m%bi#n%bi#o%bi#p%bi#q%bi#r%bi#s%bi#t%bi#u%bi#w%bi#y%bi#z%bi#}%bi'w%bi(_%bi(p%bi(w%bi!Z%bi![%bi~O#}$ny!Z$ny![$ny~P#BPO#}#ay!Z#ay![#ay~P#BPO!e#vO!Z'cq!i'cq~O!Z/kO!i(|y~O!W'eq!Z'eq~P#.{Op:pO!e#vO(p'nO~O[:tO!W:sO~P#.{O!W:sO~Og(]!R!Z(]!R~P!0uOa%Zy!]%Zy'x%Zy!Z%Zy~P#.{O!Z0}O![)Vy~O!Z5kO![)Sq~O(R:zO~O!]1gO%h:}O~O!i;QO~O%h;VO~P&7SOP${qR${q[${qp${q!Q${q!j${q!n${q#P${q#l${q#m${q#n${q#o${q#p${q#q${q#r${q#s${q#t${q#u${q#w${q#y${q#z${q#}${q(_${q(p${q!Z${q![${q~P'%sO!O)|O'w)}O(x%POP'haR'ha['hal'hap'ha!Q'ha!j'ha!n'ha#P'ha#l'ha#m'ha#n'ha#o'ha#p'ha#q'ha#r'ha#s'ha#t'ha#u'ha#w'ha#y'ha#z'ha#}'ha(_'ha(p'ha(w'ha!Z'ha!['ha~O!O)|O'w)}OP'jaR'ja['jal'jap'ja!Q'ja!j'ja!n'ja#P'ja#l'ja#m'ja#n'ja#o'ja#p'ja#q'ja#r'ja#s'ja#t'ja#u'ja#w'ja#y'ja#z'ja#}'ja(_'ja(p'ja(w'ja(x'ja!Z'ja!['ja~OP$}qR$}q[$}qp$}q!Q$}q!j$}q!n$}q#P$}q#l$}q#m$}q#n$}q#o$}q#p$}q#q$}q#r$}q#s$}q#t$}q#u$}q#w$}q#y$}q#z$}q#}$}q(_$}q(p$}q!Z$}q![$}q~P'%sOg%d!Z!Z%d!Z#^%d!Z#}%d!Z~P!0uO!W;ZO~P#.{Op;[O!e#vO(p'nO~O[;^O!W;ZO~P#.{O!Z'nq!['nq~P#BPO!Z#f!Z![#f!Z~P#BPO#i%d!ZP%d!ZR%d!Z[%d!Za%d!Zp%d!Z!Q%d!Z!Z%d!Z!j%d!Z!n%d!Z#P%d!Z#l%d!Z#m%d!Z#n%d!Z#o%d!Z#p%d!Z#q%d!Z#r%d!Z#s%d!Z#t%d!Z#u%d!Z#w%d!Z#y%d!Z#z%d!Z'x%d!Z(_%d!Z(p%d!Z!i%d!Z!W%d!Z'u%d!Z#^%d!Zt%d!Z!]%d!Z%h%d!Z!e%d!Z~P#.{Op;fO!e#vO(p'nO~O!W;gO~P#.{Op;nO!e#vO(p'nO~O!W;oO~P#.{OP%d!ZR%d!Z[%d!Zp%d!Z!Q%d!Z!j%d!Z!n%d!Z#P%d!Z#l%d!Z#m%d!Z#n%d!Z#o%d!Z#p%d!Z#q%d!Z#r%d!Z#s%d!Z#t%d!Z#u%d!Z#w%d!Z#y%d!Z#z%d!Z#}%d!Z(_%d!Z(p%d!Z!Z%d!Z![%d!Z~P'%sOp;rO!e#vO(p'nO~Ot(dX~P1qO!O%qO~P!(yO(S!lO~P!(yO!WfX!ZfX#^fX~P%0XOP]XR]X[]Xp]X!O]X!Q]X!Z]X!ZfX!j]X!n]X#P]X#Q]X#^]X#^fX#ifX#l]X#m]X#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#w]X#y]X#z]X$P]X(_]X(p]X(w]X(x]X~O!efX!i]X!ifX(pfX~P'JlOP;vOQ;vOSfOd=rOe!iOnkOp;vOqkOrkOxkOz;vO|;vO!QWO!UkO!VkO!]XO!g;yO!jZO!m;vO!n;vO!o;vO!q;zO!s;}O!v!hO$V!kO$m=pO(R)ZO(TTO(WUO(_VO(m[O~O!Z<ZO![$pa~Oh%VOn%WOp%XOq$tOr$tOx%YOz%ZO|<fO!Q${O!]$|O!g=wO!j$xO#h<lO$V%_O$s<hO$u<jO$x%`O(R(tO(TTO(WUO(_$uO(w$}O(x%PO~Oj)bO~P( bOp!cX(p!cX~P# qOp(hX(p(hX~P#!dO![]X![fX~P'JlO!WfX!W$yX!ZfX!Z$yX#^fX~P!/qO#i<OO~O!e#vO#i<OO~O#^<`O~O#t<SO~O#^<pO!Z(uX![(uX~O#^<`O!Z(sX![(sX~O#i<qO~Og<sO~P!0uO#i<yO~O#i<zO~O!e#vO#i<{O~O!e#vO#i<qO~O#}<|O~P#BPO#i<}O~O#i=OO~O#i=TO~O#i=UO~O#i=VO~O#i=WO~O#}=XO~P!0uO#}=YO~P!0uO#Q#R#S#U#V#Y#g#h#s$m$s$u$x%[%]%g%h%i%p%r%u%v%x%z~'|T#m!V'z(S#nq#l#op!O'{$['{(R$^(c~",
  goto: "$8f)ZPPPPPP)[PP)_P)pP+Q/VPPPP6aPP6wPP<oP@cP@yP@yPPP@yPCRP@yP@yP@yPCVPC[PCyPHsPPPHwPPPPHwKzPPPLQLrPHwPHwPP! QHwPPPHwPHwP!#XHwP!&o!'t!'}P!(q!(u!(q!,SPPPPPPP!,s!'tPP!-T!.uP!2RHwHw!2W!5d!:Q!:Q!>PPPP!>XHwPPPPPPPPPP!AhP!BuPPHw!DWPHwPHwHwHwHwHwPHw!EjP!HtP!KzP!LO!LY!L^!L^P!HqP!Lb!LbP# hP# lHwPHw# r#$wCV@yP@yP@y@yP#&U@y@y#(h@y#+`@y#-l@y@y#.[#0p#0p#0u#1O#0p#1ZPP#0pP@y#1s@y#5r@y@y6aPPP#9wPPP#:b#:bP#:bP#:x#:bPP#;OP#:uP#:u#;c#:u#;}#<T#<W)_#<Z)_P#<b#<b#<bP)_P)_P)_P)_PP)_P#<h#<kP#<k)_P#<oP#<rP)_P)_P)_P)_P)_P)_)_PP#<x#=O#=Z#=a#=g#=m#=s#>R#>X#>c#>i#>s#>y#?Z#?a#@R#@e#@k#@q#AP#Af#CZ#Ci#Cp#E[#Ej#G[#Gj#Gp#Gv#G|#HW#H^#Hd#Hn#IQ#IWPPPPPPPPPPP#I^PPPPPPP#JR#MY#Nr#Ny$ RPPP$&mP$&v$)o$0Y$0]$0`$1_$1b$1i$1qP$1w$1zP$2h$2l$3d$4r$4w$5_PP$5d$5j$5n$5q$5u$5y$6u$7^$7u$7y$7|$8P$8V$8Y$8^$8bR!|RoqOXst!Z#d%l&p&r&s&u,n,s2S2VY!vQ'^-`1g5qQ%svQ%{yQ&S|Q&h!VS'U!e-WQ'd!iS'j!r!yU*h$|*X*lQ+l%|Q+y&UQ,_&bQ-^']Q-h'eQ-p'kQ0U*nQ1q,`R<m;z%SdOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&p&r&s&u&y'R'`'p(R(T(Z(b(v(x(|){*f+U+Y,k,n,s-d-l-z.Q.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3d4q5y6Z6[6_6r8i8x9SS#q];w!r)]$Z$n'V)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sU*{%[<e<fQ+q&OQ,a&eQ,h&mQ0r+dQ0u+fQ1S+rQ1y,fQ3W.bQ5V0wQ5]0}Q6Q1rQ7O3[Q8U5^R9Y7Q'QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=s!S!nQ!r!v!y!z$|'U']'^'j'k'l*h*l*n*o-W-^-`-p0U0X1g5q5s%[$ti#v$b$c$d$x${%O%Q%]%^%b)w*P*R*T*W*^*d*t*u+c+f+},Q.a.z/_/h/r/s/u0Y0[0g0h0i1^1a1i3Z4U4V4a4f4w5R5U5x6|7l7v7|8Q8f9V9e9n9t:S:f:t:};V;^<^<_<a<b<c<d<g<h<i<j<k<l<t<u<v<w<y<z<}=O=P=Q=R=S=T=U=X=Y=p=x=y=|=}Q&V|Q'S!eS'Y%h-ZQ+q&OQ,a&eQ0f+OQ1S+rQ1X+xQ1x,eQ1y,fQ5]0}Q5f1ZQ6Q1rQ6T1tQ6U1wQ8U5^Q8X5cQ8q6WQ9|8YQ:Y8nR<o*XrnOXst!V!Z#d%l&g&p&r&s&u,n,s2S2VR,c&i&z^OPXYstuvwz!Z!`!g!j!o#S#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%l%s&Q&i&l&m&p&r&s&u&y'R'`'p(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=r=s[#]WZ#W#Z'V(R!b%im#h#i#l$x%d%g([(f(g(h*W*[*_+W+X+Z,j-Q.O.U.V.W.Y/h/k2[3S3T4X6h6yQ%vxQ%zyS&P|&UQ&]!TQ'a!hQ'c!iQ(o#sS+k%{%|Q+o&OQ,Y&`Q,^&bS-g'd'eQ.d(pQ0{+lQ1R+rQ1T+sQ1W+wQ1l,ZS1p,_,`Q2t-hQ5[0}Q5`1QQ5e1YQ6P1qQ8T5^Q8W5bQ9x8SR:w9y!U$zi$d%O%Q%]%^%b*P*R*^*t*u.z/r0Y0[0g0h0i4V4w7|9e=p=x=y!^%xy!i!u%z%{%|'T'c'd'e'i's*g+k+l-T-g-h-o/{0O0{2m2t2{4i4j4m7s9pQ+e%vQ,O&YQ,R&ZQ,]&bQ.c(oQ1k,YU1o,^,_,`Q3].dQ5z1lS6O1p1qQ8m6P#f=t#v$b$c$x${)w*T*W*d+c+f+},Q.a/_/h/s/u1^1a1i3Z4U4a4f5R5U5x6|7l7v8Q8f9V9n9t:S:f:t:};V;^<a<c<g<i<k<t<v<y<}=P=R=T=X=|=}o=u<^<_<b<d<h<j<l<u<w<z=O=Q=S=U=YW%Ti%V*v=pS&Y!Q&gQ&Z!RQ&[!SQ+S%cR+|&W%]%Si#v$b$c$d$x${%O%Q%]%^%b)w*P*R*T*W*^*d*t*u+c+f+},Q.a.z/_/h/r/s/u0Y0[0g0h0i1^1a1i3Z4U4V4a4f4w5R5U5x6|7l7v7|8Q8f9V9e9n9t:S:f:t:};V;^<^<_<a<b<c<d<g<h<i<j<k<l<t<u<v<w<y<z<}=O=P=Q=R=S=T=U=X=Y=p=x=y=|=}T)x$u)yV*{%[<e<fW'Y!e%h*X-ZS({#y#zQ+`%qQ+v&RS.](k(lQ1b,SQ4x0cR8^5k'QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=s$i$^c#Y#e%p%r%t(Q(W(r(w)P)Q)R)S)T)U)V)W)X)Y)[)^)`)e)o+a+u-U-s-x-}.P.n.q.u.w.x.y/]0j2c2f2v2}3c3h3i3j3k3l3m3n3o3p3q3r3s3t3w3x4P5O5Y6k6q6v7V7W7a7b8`8|9Q9[9b9c:c:y;R;x=gT#TV#U'RkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sQ'W!eR2i-W!W!nQ!e!r!v!y!z$|'U']'^'j'k'l*X*h*l*n*o-W-^-`-p0U0X1g5q5sR1d,UnqOXst!Z#d%l&p&r&s&u,n,s2S2VQ&w!^Q't!xS(q#u<OQ+i%yQ,W&]Q,X&_Q-e'bQ-r'mS.m(v<qS0k+U<{Q0y+jQ1f,VQ2Z,uQ2],vQ2e-RQ2r-fQ2u-jS5P0l=VQ5W0zS5Z0|=WQ6j2gQ6n2sQ6s2zQ8R5XQ8}6lQ9O6oQ9R6tR:`8z$d$]c#Y#e%r%t(Q(W(r(w)P)Q)R)S)T)U)V)W)X)Y)[)^)`)e)o+a+u-U-s-x-}.P.n.q.u.x.y/]0j2c2f2v2}3c3h3i3j3k3l3m3n3o3p3q3r3s3t3w3x4P5O5Y6k6q6v7V7W7a7b8`8|9Q9[9b9c:c:y;R;x=gS(m#p'gQ(}#zS+_%p.wS.^(l(nR3U._'QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sS#q];wQ&r!XQ&s!YQ&u![Q&v!]R2R,qQ'_!hQ+b%vQ-c'aS.`(o+eQ2p-bW3Y.c.d0q0sQ6m2qW6z3V3X3]5TU9U6{6}7PU:e9W9X9ZS;T:d:gQ;b;UR;j;cU!wQ'^-`T5o1g5q!Q_OXZ`st!V!Z#d#h%d%l&g&i&p&r&s&u(h,n,s.V2S2V]!pQ!r'^-`1g5qT#q];w%^{OPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&m&p&r&s&u&y'R'`'p(R(T(Z(b(v(x(|){*f+U+Y+d,k,n,s-d-l-z.Q.b.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3[3d4q5y6Z6[6_6r7Q8i8x9SS({#y#zS.](k(l!s=^$Z$n'V)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sU$fd)],hS(n#p'gU*s%R(u3vU0e*z.i7]Q5T0rQ6{3WQ9X7OR:g9Ym!tQ!r!v!y!z'^'j'k'l-`-p1g5q5sQ'r!uS(d#g1|S-n'i'uQ/n*ZQ/{*gQ2|-qQ4]/oQ4i/}Q4j0OQ4o0WQ7h4WS7s4k4mS7w4p4rQ9g7iQ9k7oQ9p7tQ9u7yS:o9l9mS;Y:p:sS;e;Z;[S;m;f;gS;q;n;oR;t;rQ#wbQ'q!uS(c#g1|S(e#m+TQ+V%eQ+g%wQ+m%}U-m'i'r'uQ.R(dQ/m*ZQ/|*gQ0P*iQ0x+hQ1m,[S2y-n-qQ3R.ZS4[/n/oQ4e/yS4h/{0WQ4l0QQ5|1nQ6u2|Q7g4WQ7k4]U7r4i4o4rQ7u4nQ8k5}S9f7h7iQ9j7oQ9r7wQ9s7xQ:V8lQ:m9gS:n9k9mQ:v9uQ;P:WS;X:o:sS;d;Y;ZS;l;e;gS;p;m;oQ;s;qQ;u;tQ=a=[Q=l=eR=m=fV!wQ'^-`%^aOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&m&p&r&s&u&y'R'`'p(R(T(Z(b(v(x(|){*f+U+Y+d,k,n,s-d-l-z.Q.b.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3[3d4q5y6Z6[6_6r7Q8i8x9SS#wz!j!r=Z$Z$n'V)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sR=a=r%^bOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&m&p&r&s&u&y'R'`'p(R(T(Z(b(v(x(|){*f+U+Y+d,k,n,s-d-l-z.Q.b.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3[3d4q5y6Z6[6_6r7Q8i8x9SQ%ej!^%wy!i!u%z%{%|'T'c'd'e'i's*g+k+l-T-g-h-o/{0O0{2m2t2{4i4j4m7s9pS%}z!jQ+h%xQ,[&bW1n,],^,_,`U5}1o1p1qS8l6O6PQ:W8m!r=[$Z$n'V)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sQ=e=qR=f=r%QeOPXYstuvw!Z!`!g!o#S#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&p&r&s&u&y'R'`'p(T(Z(b(v(x(|){*f+U+Y+d,k,n,s-d-l-z.Q.b.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3[3d4q5y6Z6[6_6r7Q8i8x9SY#bWZ#W#Z(R!b%im#h#i#l$x%d%g([(f(g(h*W*[*_+W+X+Z,j-Q.O.U.V.W.Y/h/k2[3S3T4X6h6yQ,i&m!p=]$Z$n)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sR=`'VU'Z!e%h*XR2k-Z%SdOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&p&r&s&u&y'R'`'p(R(T(Z(b(v(x(|){*f+U+Y,k,n,s-d-l-z.Q.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3d4q5y6Z6[6_6r8i8x9S!r)]$Z$n'V)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sQ,h&mQ0r+dQ3W.bQ7O3[R9Y7Q!b$Tc#Y%p(Q(W(r(w)X)Y)^)e+u-s-x-}.P.n.q/]0j2v2}3c3s5O5Y6q6v7V9Q:c;x!P<U)[)o-U.w2c2f3h3q3r3w4P6k7W7a7b8`8|9[9b9c:y;R=g!f$Vc#Y%p(Q(W(r(w)U)V)X)Y)^)e+u-s-x-}.P.n.q/]0j2v2}3c3s5O5Y6q6v7V9Q:c;x!T<W)[)o-U.w2c2f3h3n3o3q3r3w4P6k7W7a7b8`8|9[9b9c:y;R=g!^$Zc#Y%p(Q(W(r(w)^)e+u-s-x-}.P.n.q/]0j2v2}3c3s5O5Y6q6v7V9Q:c;xQ4V/fz=s)[)o-U.w2c2f3h3w4P6k7W7a7b8`8|9[9b9c:y;R=gQ=x=zR=y={'QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sS$oh$pR3|/P'XgOPWXYZhstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n$p%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/P/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sT$kf$qQ$ifS)h$l)lR)t$qT$jf$qT)j$l)l'XhOPWXYZhstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n$p%l%s&Q&i&l&m&p&r&s&u&y'R'V'`'p(R(T(Z(b(v(x(|)q){*f+U+Y+d,k,n,s-P-S-d-l-z.Q.b.o.v/P/Q/i0V0d0l0|1j1z1{1}2P2S2V2X2h2x3O3[3d3{4q5m5y6Z6[6_6i6r7Q8i8x9S9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=sT$oh$pQ$rhR)s$p%^jOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%l%s&Q&i&l&m&p&r&s&u&y'R'`'p(R(T(Z(b(v(x(|){*f+U+Y+d,k,n,s-d-l-z.Q.b.o.v/i0V0d0l0|1j1z1{1}2P2S2V2X2x3O3[3d4q5y6Z6[6_6r7Q8i8x9S!s=q$Z$n'V)q-P-S/Q2h3{5m6i9}:a;v;y;z;}<O<P<Q<R<S<T<U<V<W<X<Y<Z<]<`<m<p<q<s<{<|=V=W=s#glOPXZst!Z!`!o#S#d#o#{$n%l&i&l&m&p&r&s&u&y'R'`(|)q*f+Y+d,k,n,s-d.b/Q/i0V0d1j1z1{1}2P2S2V2X3[3{4q5y6Z6[6_7Q8i8x!U%Ri$d%O%Q%]%^%b*P*R*^*t*u.z/r0Y0[0g0h0i4V4w7|9e=p=x=y#f(u#v$b$c$x${)w*T*W*d+c+f+},Q.a/_/h/s/u1^1a1i3Z4U4a4f5R5U5x6|7l7v8Q8f9V9n9t:S:f:t:};V;^<a<c<g<i<k<t<v<y<}=P=R=T=X=|=}Q+P%`Q/^)|o3v<^<_<b<d<h<j<l<u<w<z=O=Q=S=U=Y!U$yi$d%O%Q%]%^%b*P*R*^*t*u.z/r0Y0[0g0h0i4V4w7|9e=p=x=yQ*`$zU*i$|*X*lQ+Q%aQ0Q*j#f=c#v$b$c$x${)w*T*W*d+c+f+},Q.a/_/h/s/u1^1a1i3Z4U4a4f5R5U5x6|7l7v8Q8f9V9n9t:S:f:t:};V;^<a<c<g<i<k<t<v<y<}=P=R=T=X=|=}n=d<^<_<b<d<h<j<l<u<w<z=O=Q=S=U=YQ=h=tQ=i=uQ=j=vR=k=w!U%Ri$d%O%Q%]%^%b*P*R*^*t*u.z/r0Y0[0g0h0i4V4w7|9e=p=x=y#f(u#v$b$c$x${)w*T*W*d+c+f+},Q.a/_/h/s/u1^1a1i3Z4U4a4f5R5U5x6|7l7v8Q8f9V9n9t:S:f:t:};V;^<a<c<g<i<k<t<v<y<}=P=R=T=X=|=}o3v<^<_<b<d<h<j<l<u<w<z=O=Q=S=U=YnoOXst!Z#d%l&p&r&s&u,n,s2S2VS*c${*WQ,|&|Q,}'OR4`/s%[%Si#v$b$c$d$x${%O%Q%]%^%b)w*P*R*T*W*^*d*t*u+c+f+},Q.a.z/_/h/r/s/u0Y0[0g0h0i1^1a1i3Z4U4V4a4f4w5R5U5x6|7l7v7|8Q8f9V9e9n9t:S:f:t:};V;^<^<_<a<b<c<d<g<h<i<j<k<l<t<u<v<w<y<z<}=O=P=Q=R=S=T=U=X=Y=p=x=y=|=}Q,P&ZQ1`,RQ5i1_R8]5jV*k$|*X*lU*k$|*X*lT5p1g5qS/y*f/iQ4n0VT7x4q:PQ+g%wQ0P*iQ0x+hQ1m,[Q5|1nQ8k5}Q:V8lR;P:W!U%Oi$d%O%Q%]%^%b*P*R*^*t*u.z/r0Y0[0g0h0i4V4w7|9e=p=x=yx*P$v)c*Q*r+R/q0^0_3y4^4{4|4}7f7z9v:l=b=n=oS0Y*q0Z#f<a#v$b$c$x${)w*T*W*d+c+f+},Q.a/_/h/s/u1^1a1i3Z4U4a4f5R5U5x6|7l7v8Q8f9V9n9t:S:f:t:};V;^<a<c<g<i<k<t<v<y<}=P=R=T=X=|=}n<b<^<_<b<d<h<j<l<u<w<z=O=Q=S=U=Y!d<t(s)a*Y*b.e.h.l/Y/f/v0p1]3`4S4_4c5h7R7U7m7p7}8P9i9q9w:q:u;W;];h=z={`<u3u7X7[7`9]:h:k;kS=P.g3aT=Q7Z9`!U%Qi$d%O%Q%]%^%b*P*R*^*t*u.z/r0Y0[0g0h0i4V4w7|9e=p=x=y|*R$v)c*S*q+R/b/q0^0_3y4^4s4{4|4}7f7z9v:l=b=n=oS0[*r0]#f<c#v$b$c$x${)w*T*W*d+c+f+},Q.a/_/h/s/u1^1a1i3Z4U4a4f5R5U5x6|7l7v8Q8f9V9n9t:S:f:t:};V;^<a<c<g<i<k<t<v<y<}=P=R=T=X=|=}n<d<^<_<b<d<h<j<l<u<w<z=O=Q=S=U=Y!h<v(s)a*Y*b.f.g.l/Y/f/v0p1]3^3`4S4_4c5h7R7S7U7m7p7}8P9i9q9w:q:u;W;];h=z={d<w3u7Y7Z7`9]9^:h:i:k;kS=R.h3bT=S7[9arnOXst!V!Z#d%l&g&p&r&s&u,n,s2S2VQ&d!UR,k&mrnOXst!V!Z#d%l&g&p&r&s&u,n,s2S2VR&d!UQ,T&[R1[+|snOXst!V!Z#d%l&g&p&r&s&u,n,s2S2VQ1h,YS5w1k1lU8e5u5v5zS:R8g8hS:{:Q:TQ;_:|R;i;`Q&k!VR,d&gR6T1tR:Y8nS&P|&UR1T+sQ&p!WR,n&qR,t&vT2T,s2VR,x&wQ,w&wR2^,xQ'w!{R-t'wSsOtQ#dXT%os#dQ#OTR'y#OQ#RUR'{#RQ)y$uR/Z)yQ#UVR(O#UQ#XWU(U#X(V-{Q(V#YR-{(WQ-X'WR2j-XQ.p(wS3e.p3fR3f.qQ-`'^R2n-`Y!rQ'^-`1g5qR'h!rQ.{)cR3z.{U#_W%g*WU(]#_(^-|Q(^#`R-|(XQ-['ZR2l-[t`OXst!V!Z#d%l&g&i&p&r&s&u,n,s2S2VS#hZ%dU#r`#h.VR.V(hQ(i#jQ.S(eW.[(i.S3P6wQ3P.TR6w3QQ)l$lR/R)lQ$phR)r$pQ$`cU)_$`-w<[Q-w;xR<[)oQ/l*ZW4Y/l4Z7j9hU4Z/m/n/oS7j4[4]R9h7k$e*O$v(s)a)c*Y*b*q*r*|*}+R.g.h.j.k.l/Y/b/d/f/q/v0^0_0p1]3^3_3`3u3y4S4^4_4c4s4u4{4|4}5h7R7S7T7U7Z7[7^7_7`7f7m7p7z7}8P9]9^9_9i9q9v9w:h:i:j:k:l:q:u;W;];h;k=b=n=o=z={Q/t*bU4b/t4d7nQ4d/vR7n4cS*l$|*XR0S*lx*Q$v)c*q*r+R/q0^0_3y4^4{4|4}7f7z9v:l=b=n=o!d.e(s)a*Y*b.g.h.l/Y/f/v0p1]3`4S4_4c5h7R7U7m7p7}8P9i9q9w:q:u;W;];h=z={U/c*Q.e7Xa7X3u7Z7[7`9]:h:k;kQ0Z*qQ3a.gU4t0Z3a9`R9`7Z|*S$v)c*q*r+R/b/q0^0_3y4^4s4{4|4}7f7z9v:l=b=n=o!h.f(s)a*Y*b.g.h.l/Y/f/v0p1]3^3`4S4_4c5h7R7S7U7m7p7}8P9i9q9w:q:u;W;];h=z={U/e*S.f7Ye7Y3u7Z7[7`9]9^:h:i:k;kQ0]*rQ3b.hU4v0]3b9aR9a7[Q*w%UR0a*wQ5S0pR8O5SQ+[%jR0o+[Q5l1bS8_5l:OR:O8`Q,V&]R1e,VQ5q1gR8b5qQ1s,aS6R1s8oR8o6TQ1O+oW5_1O5a8V9zQ5a1RQ8V5`R9z8WQ+t&PR1U+tQ2V,sR6c2VYrOXst#dQ&t!ZQ+^%lQ,m&pQ,o&rQ,p&sQ,r&uQ2Q,nS2T,s2VR6b2SQ%npQ&x!_Q&{!aQ&}!bQ'P!cQ'o!uQ+]%kQ+i%yQ+{&VQ,c&kQ,z&zW-k'i'q'r'uQ-r'mQ0R*kQ0y+jS1v,d,gQ2_,yQ2`,|Q2a,}Q2u-jW2w-m-n-q-sQ5W0zQ5d1XQ5g1]Q5{1mQ6V1xQ6a2RU6p2v2y2|Q6s2zQ8R5XQ8Z5fQ8[5hQ8a5pQ8j5|Q8p6US9P6q6uQ9R6tQ9{8XQ:U8kQ:Z8qQ:b9QQ:x9|Q;O:VQ;S:cR;a;PQ%yyQ'b!iQ'm!uU+j%z%{%|Q-R'TU-f'c'd'eS-j'i'sQ/z*gS0z+k+lQ2g-TS2s-g-hQ2z-oS4g/{0OQ5X0{Q6l2mQ6o2tQ6t2{U7q4i4j4mQ9o7sR:r9pS$wi=pR*x%VU%Ui%V=pR0`*vQ$viS(s#v+fS)a$b$cQ)c$dQ*Y$xS*b${*WQ*q%OQ*r%QQ*|%]Q*}%^Q+R%bQ.g<aQ.h<cQ.j<gQ.k<iQ.l<kQ/Y)wQ/b*PQ/d*RQ/f*TQ/q*^S/v*d/hQ0^*tQ0_*ul0p+c,Q.a1a1i3Z5x6|8f9V:S:f:};VQ1]+}Q3^<tQ3_<vQ3`<yS3u<^<_Q3y.zS4S/_4UQ4^/rQ4_/sQ4c/uQ4s0YQ4u0[Q4{0gQ4|0hQ4}0iQ5h1^Q7R<}Q7S=PQ7T=RQ7U=TQ7Z<bQ7[<dQ7^<hQ7_<jQ7`<lQ7f4VQ7m4aQ7p4fQ7z4wQ7}5RQ8P5UQ9]<zQ9^<uQ9_<wQ9i7lQ9q7vQ9v7|Q9w8QQ:h=OQ:i=QQ:j=SQ:k=UQ:l9eQ:q9nQ:u9tQ;W=XQ;]:tQ;h;^Q;k=YQ=b=pQ=n=xQ=o=yQ=z=|R={=}Q*z%[Q.i<eR7]<fnpOXst!Z#d%l&p&r&s&u,n,s2S2VQ!fPS#fZ#oQ&z!`W'f!o*f0V4qQ'}#SQ)O#{Q)p$nS,g&i&lQ,l&mQ,y&yS-O'R/iQ-b'`Q.s(|Q/V)qQ0m+YQ0s+dQ2O,kQ2q-dQ3X.bQ4O/QQ4y0dQ5v1jQ6X1zQ6Y1{Q6^1}Q6`2PQ6e2XQ7P3[Q7c3{Q8h5yQ8t6ZQ8u6[Q8w6_Q9Z7QQ:T8iR:_8x#[cOPXZst!Z!`!o#d#o#{%l&i&l&m&p&r&s&u&y'R'`(|*f+Y+d,k,n,s-d.b/i0V0d1j1z1{1}2P2S2V2X3[4q5y6Z6[6_7Q8i8xQ#YWQ#eYQ%puQ%rvS%tw!gS(Q#W(TQ(W#ZQ(r#uQ(w#xQ)P$OQ)Q$PQ)R$QQ)S$RQ)T$SQ)U$TQ)V$UQ)W$VQ)X$WQ)Y$XQ)[$ZQ)^$_Q)`$aQ)e$eW)o$n)q/Q3{Q+a%sQ+u&QS-U'V2hQ-s'pS-x(R-zQ-}(ZQ.P(bQ.n(vQ.q(xQ.u;vQ.w;yQ.x;zQ.y;}Q/]){Q0j+UQ2c-PQ2f-SQ2v-lQ2}.QQ3c.oQ3h<OQ3i<PQ3j<QQ3k<RQ3l<SQ3m<TQ3n<UQ3o<VQ3p<WQ3q<XQ3r<YQ3s.vQ3t<]Q3w<`Q3x<mQ4P<ZQ5O0lQ5Y0|Q6k<pQ6q2xQ6v3OQ7V3dQ7W<qQ7a<sQ7b<{Q8`5mQ8|6iQ9Q6rQ9[<|Q9b=VQ9c=WQ:c9SQ:y9}Q;R:aQ;x#SR=g=sR#[WR'X!el!tQ!r!v!y!z'^'j'k'l-`-p1g5q5sS'T!e-WU*g$|*X*lS-T'U']S0O*h*nQ0W*oQ2m-^Q4m0UR4r0XR(y#xQ!fQT-_'^-`]!qQ!r'^-`1g5qQ#p]R'g;wR)d$dY!uQ'^-`1g5qQ'i!rS's!v!yS'u!z5sS-o'j'kQ-q'lR2{-pT#kZ%dS#jZ%dS%jm,jU(e#h#i#lS.T(f(gQ.X(hQ0n+ZQ3Q.UU3R.V.W.YS6x3S3TR9T6yd#^W#W#Z%g(R([*W+W.O/hr#gZm#h#i#l%d(f(g(h+Z.U.V.W.Y3S3T6yS*Z$x*_Q/o*[Q1|,jQ2d-QQ4W/kQ6g2[Q7i4XQ8{6hT=_'V+XV#aW%g*WU#`W%g*WS(S#W([U(X#Z+W/hS-V'V+XT-y(R.OV'[!e%h*XQ$lfR)v$qT)k$l)lR3}/PT*]$x*_T*e${*WQ0q+cQ1_,QQ3V.aQ5j1aQ5u1iQ6}3ZQ8g5xQ9W6|Q:Q8fQ:d9VQ:|:SQ;U:fQ;`:}R;c;VnqOXst!Z#d%l&p&r&s&u,n,s2S2VQ&j!VR,c&gtmOXst!U!V!Z#d%l&g&p&r&s&u,n,s2S2VR,j&mT%km,jR1c,SR,b&eQ&T|R+z&UR+p&OT&n!W&qT&o!W&qT2U,s2V",
  nodeNames: "⚠ ArithOp ArithOp ?. JSXStartTag LineComment BlockComment Script Hashbang ExportDeclaration export Star as VariableName String Escape from ; default FunctionDeclaration async function VariableDefinition > < TypeParamList const TypeDefinition extends ThisType this LiteralType ArithOp Number BooleanLiteral TemplateType InterpolationEnd Interpolation InterpolationStart NullType null VoidType void TypeofType typeof MemberExpression . PropertyName [ TemplateString Escape Interpolation super RegExp ] ArrayExpression Spread , } { ObjectExpression Property async get set PropertyDefinition Block : NewTarget new NewExpression ) ( ArgList UnaryExpression delete LogicOp BitOp YieldExpression yield AwaitExpression await ParenthesizedExpression ClassExpression class ClassBody MethodDeclaration Decorator @ MemberExpression PrivatePropertyName CallExpression TypeArgList CompareOp < declare Privacy static abstract override PrivatePropertyDefinition PropertyDeclaration readonly accessor Optional TypeAnnotation Equals StaticBlock FunctionExpression ArrowFunction ParamList ParamList ArrayPattern ObjectPattern PatternProperty Privacy readonly Arrow MemberExpression BinaryExpression ArithOp ArithOp ArithOp ArithOp BitOp CompareOp instanceof satisfies in CompareOp BitOp BitOp BitOp LogicOp LogicOp ConditionalExpression LogicOp LogicOp AssignmentExpression UpdateOp PostfixExpression CallExpression InstantiationExpression TaggedTemplateExpression DynamicImport import ImportMeta JSXElement JSXSelfCloseEndTag JSXSelfClosingTag JSXIdentifier JSXBuiltin JSXIdentifier JSXNamespacedName JSXMemberExpression JSXSpreadAttribute JSXAttribute JSXAttributeValue JSXEscape JSXEndTag JSXOpenTag JSXFragmentTag JSXText JSXEscape JSXStartCloseTag JSXCloseTag PrefixCast < ArrowFunction TypeParamList SequenceExpression InstantiationExpression KeyofType keyof UniqueType unique ImportType InferredType infer TypeName ParenthesizedType FunctionSignature ParamList NewSignature IndexedType TupleType Label ArrayType ReadonlyType ObjectType MethodType PropertyType IndexSignature PropertyDefinition CallSignature TypePredicate asserts is NewSignature new UnionType LogicOp IntersectionType LogicOp ConditionalType ParameterizedType ClassDeclaration abstract implements type VariableDeclaration let var using TypeAliasDeclaration InterfaceDeclaration interface EnumDeclaration enum EnumBody NamespaceDeclaration namespace module AmbientDeclaration declare GlobalDeclaration global ClassDeclaration ClassBody AmbientFunctionDeclaration ExportGroup VariableName VariableName ImportDeclaration ImportGroup ForStatement for ForSpec ForInSpec ForOfSpec of WhileStatement while WithStatement with DoStatement do IfStatement if else SwitchStatement switch SwitchBody CaseLabel case DefaultLabel TryStatement try CatchClause catch FinallyClause finally ReturnStatement return ThrowStatement throw BreakStatement break ContinueStatement continue DebuggerStatement debugger LabeledStatement ExpressionStatement SingleExpression SingleClassItem",
  maxTerm: 378,
  context: trackNewline,
  nodeProps: [
    ["isolate", -8,5,6,14,35,37,49,51,53,""],
    ["group", -26,9,17,19,66,206,210,214,215,217,220,223,233,235,241,243,245,247,250,256,262,264,266,268,270,272,273,"Statement",-34,13,14,30,33,34,40,49,52,53,55,60,68,70,74,78,80,82,83,108,109,118,119,135,138,140,141,142,143,144,146,147,166,168,170,"Expression",-23,29,31,35,39,41,43,172,174,176,177,179,180,181,183,184,185,187,188,189,200,202,204,205,"Type",-3,86,101,107,"ClassItem"],
    ["openedBy", 23,"<",36,"InterpolationStart",54,"[",58,"{",71,"(",159,"JSXStartCloseTag"],
    ["closedBy", -2,24,167,">",38,"InterpolationEnd",48,"]",59,"}",72,")",164,"JSXEndTag"]
  ],
  propSources: [jsHighlight],
  skippedNodes: [0,5,6,276],
  repeatNodeCount: 37,
  tokenData: "$Fq07[R!bOX%ZXY+gYZ-yZ[+g[]%Z]^.c^p%Zpq+gqr/mrs3cst:_tuEruvJSvwLkwx! Yxy!'iyz!(sz{!)}{|!,q|}!.O}!O!,q!O!P!/Y!P!Q!9j!Q!R#:O!R![#<_![!]#I_!]!^#Jk!^!_#Ku!_!`$![!`!a$$v!a!b$*T!b!c$,r!c!}Er!}#O$-|#O#P$/W#P#Q$4o#Q#R$5y#R#SEr#S#T$7W#T#o$8b#o#p$<r#p#q$=h#q#r$>x#r#s$@U#s$f%Z$f$g+g$g#BYEr#BY#BZ$A`#BZ$ISEr$IS$I_$A`$I_$I|Er$I|$I}$Dk$I}$JO$Dk$JO$JTEr$JT$JU$A`$JU$KVEr$KV$KW$A`$KW&FUEr&FU&FV$A`&FV;'SEr;'S;=`I|<%l?HTEr?HT?HU$A`?HUOEr(n%d_$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z&j&hT$h&jO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c&j&zP;=`<%l&c'|'U]$h&j(X!bOY&}YZ&cZw&}wx&cx!^&}!^!_'}!_#O&}#O#P&c#P#o&}#o#p'}#p;'S&};'S;=`(l<%lO&}!b(SU(X!bOY'}Zw'}x#O'}#P;'S'};'S;=`(f<%lO'}!b(iP;=`<%l'}'|(oP;=`<%l&}'[(y]$h&j(UpOY(rYZ&cZr(rrs&cs!^(r!^!_)r!_#O(r#O#P&c#P#o(r#o#p)r#p;'S(r;'S;=`*a<%lO(rp)wU(UpOY)rZr)rs#O)r#P;'S)r;'S;=`*Z<%lO)rp*^P;=`<%l)r'[*dP;=`<%l(r#S*nX(Up(X!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g#S+^P;=`<%l*g(n+dP;=`<%l%Z07[+rq$h&j(Up(X!b'z0/lOX%ZXY+gYZ&cZ[+g[p%Zpq+gqr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p$f%Z$f$g+g$g#BY%Z#BY#BZ+g#BZ$IS%Z$IS$I_+g$I_$JT%Z$JT$JU+g$JU$KV%Z$KV$KW+g$KW&FU%Z&FU&FV+g&FV;'S%Z;'S;=`+a<%l?HT%Z?HT?HU+g?HUO%Z07[.ST(V#S$h&j'{0/lO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c07[.n_$h&j(Up(X!b'{0/lOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z)3p/x`$h&j!n),Q(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`0z!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW1V`#u(Ch$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`2X!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW2d_#u(Ch$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'At3l_(T':f$h&j(X!bOY4kYZ5qZr4krs7nsw4kwx5qx!^4k!^!_8p!_#O4k#O#P5q#P#o4k#o#p8p#p;'S4k;'S;=`:X<%lO4k(^4r_$h&j(X!bOY4kYZ5qZr4krs7nsw4kwx5qx!^4k!^!_8p!_#O4k#O#P5q#P#o4k#o#p8p#p;'S4k;'S;=`:X<%lO4k&z5vX$h&jOr5qrs6cs!^5q!^!_6y!_#o5q#o#p6y#p;'S5q;'S;=`7h<%lO5q&z6jT$c`$h&jO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c`6|TOr6yrs7]s;'S6y;'S;=`7b<%lO6y`7bO$c``7eP;=`<%l6y&z7kP;=`<%l5q(^7w]$c`$h&j(X!bOY&}YZ&cZw&}wx&cx!^&}!^!_'}!_#O&}#O#P&c#P#o&}#o#p'}#p;'S&};'S;=`(l<%lO&}!r8uZ(X!bOY8pYZ6yZr8prs9hsw8pwx6yx#O8p#O#P6y#P;'S8p;'S;=`:R<%lO8p!r9oU$c`(X!bOY'}Zw'}x#O'}#P;'S'};'S;=`(f<%lO'}!r:UP;=`<%l8p(^:[P;=`<%l4k%9[:hh$h&j(Up(X!bOY%ZYZ&cZq%Zqr<Srs&}st%ZtuCruw%Zwx(rx!^%Z!^!_*g!_!c%Z!c!}Cr!}#O%Z#O#P&c#P#R%Z#R#SCr#S#T%Z#T#oCr#o#p*g#p$g%Z$g;'SCr;'S;=`El<%lOCr(r<__WS$h&j(Up(X!bOY<SYZ&cZr<Srs=^sw<Swx@nx!^<S!^!_Bm!_#O<S#O#P>`#P#o<S#o#pBm#p;'S<S;'S;=`Cl<%lO<S(Q=g]WS$h&j(X!bOY=^YZ&cZw=^wx>`x!^=^!^!_?q!_#O=^#O#P>`#P#o=^#o#p?q#p;'S=^;'S;=`@h<%lO=^&n>gXWS$h&jOY>`YZ&cZ!^>`!^!_?S!_#o>`#o#p?S#p;'S>`;'S;=`?k<%lO>`S?XSWSOY?SZ;'S?S;'S;=`?e<%lO?SS?hP;=`<%l?S&n?nP;=`<%l>`!f?xWWS(X!bOY?qZw?qwx?Sx#O?q#O#P?S#P;'S?q;'S;=`@b<%lO?q!f@eP;=`<%l?q(Q@kP;=`<%l=^'`@w]WS$h&j(UpOY@nYZ&cZr@nrs>`s!^@n!^!_Ap!_#O@n#O#P>`#P#o@n#o#pAp#p;'S@n;'S;=`Bg<%lO@ntAwWWS(UpOYApZrAprs?Ss#OAp#O#P?S#P;'SAp;'S;=`Ba<%lOAptBdP;=`<%lAp'`BjP;=`<%l@n#WBvYWS(Up(X!bOYBmZrBmrs?qswBmwxApx#OBm#O#P?S#P;'SBm;'S;=`Cf<%lOBm#WCiP;=`<%lBm(rCoP;=`<%l<S%9[C}i$h&j(m%1l(Up(X!bOY%ZYZ&cZr%Zrs&}st%ZtuCruw%Zwx(rx!Q%Z!Q![Cr![!^%Z!^!_*g!_!c%Z!c!}Cr!}#O%Z#O#P&c#P#R%Z#R#SCr#S#T%Z#T#oCr#o#p*g#p$g%Z$g;'SCr;'S;=`El<%lOCr%9[EoP;=`<%lCr07[FRk$h&j(Up(X!b$[#t(R,2j(c$I[OY%ZYZ&cZr%Zrs&}st%ZtuEruw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Er![!^%Z!^!_*g!_!c%Z!c!}Er!}#O%Z#O#P&c#P#R%Z#R#SEr#S#T%Z#T#oEr#o#p*g#p$g%Z$g;'SEr;'S;=`I|<%lOEr+dHRk$h&j(Up(X!b$[#tOY%ZYZ&cZr%Zrs&}st%ZtuGvuw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Gv![!^%Z!^!_*g!_!c%Z!c!}Gv!}#O%Z#O#P&c#P#R%Z#R#SGv#S#T%Z#T#oGv#o#p*g#p$g%Z$g;'SGv;'S;=`Iv<%lOGv+dIyP;=`<%lGv07[JPP;=`<%lEr(KWJ_`$h&j(Up(X!b#n(ChOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KWKl_$h&j$P(Ch(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z,#xLva(x+JY$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sv%ZvwM{wx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KWNW`$h&j#y(Ch(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'At! c_(W';W$h&j(UpOY!!bYZ!#hZr!!brs!#hsw!!bwx!$xx!^!!b!^!_!%z!_#O!!b#O#P!#h#P#o!!b#o#p!%z#p;'S!!b;'S;=`!'c<%lO!!b'l!!i_$h&j(UpOY!!bYZ!#hZr!!brs!#hsw!!bwx!$xx!^!!b!^!_!%z!_#O!!b#O#P!#h#P#o!!b#o#p!%z#p;'S!!b;'S;=`!'c<%lO!!b&z!#mX$h&jOw!#hwx6cx!^!#h!^!_!$Y!_#o!#h#o#p!$Y#p;'S!#h;'S;=`!$r<%lO!#h`!$]TOw!$Ywx7]x;'S!$Y;'S;=`!$l<%lO!$Y`!$oP;=`<%l!$Y&z!$uP;=`<%l!#h'l!%R]$c`$h&j(UpOY(rYZ&cZr(rrs&cs!^(r!^!_)r!_#O(r#O#P&c#P#o(r#o#p)r#p;'S(r;'S;=`*a<%lO(r!Q!&PZ(UpOY!%zYZ!$YZr!%zrs!$Ysw!%zwx!&rx#O!%z#O#P!$Y#P;'S!%z;'S;=`!']<%lO!%z!Q!&yU$c`(UpOY)rZr)rs#O)r#P;'S)r;'S;=`*Z<%lO)r!Q!'`P;=`<%l!%z'l!'fP;=`<%l!!b/5|!'t_!j/.^$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z#&U!)O_!i!Lf$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z-!n!*[b$h&j(Up(X!b(S%&f#o(ChOY%ZYZ&cZr%Zrs&}sw%Zwx(rxz%Zz{!+d{!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW!+o`$h&j(Up(X!b#l(ChOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z+;x!,|`$h&j(Up(X!bp+4YOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z,$U!.Z_!Z+Jf$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[!/ec$h&j(Up(X!b!O.2^OY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!0p!P!Q%Z!Q![!3Y![!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z#%|!0ya$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!2O!P!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z#%|!2Z_!Y!L^$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!3eg$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![!3Y![!^%Z!^!_*g!_!g%Z!g!h!4|!h#O%Z#O#P&c#P#R%Z#R#S!3Y#S#X%Z#X#Y!4|#Y#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!5Vg$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx{%Z{|!6n|}%Z}!O!6n!O!Q%Z!Q![!8S![!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S!8S#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!6wc$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![!8S![!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S!8S#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!8_c$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![!8S![!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S!8S#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[!9uf$h&j(Up(X!b#m(ChOY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcxz!;Zz{#-}{!P!;Z!P!Q#/d!Q!^!;Z!^!_#(i!_!`#7S!`!a#8i!a!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z?O!;fb$h&j(Up(X!b!V7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z>^!<w`$h&j(X!b!V7`OY!<nYZ&cZw!<nwx!=yx!P!<n!P!Q!Eq!Q!^!<n!^!_!Gr!_!}!<n!}#O!KS#O#P!Dy#P#o!<n#o#p!Gr#p;'S!<n;'S;=`!L]<%lO!<n<z!>Q^$h&j!V7`OY!=yYZ&cZ!P!=y!P!Q!>|!Q!^!=y!^!_!@c!_!}!=y!}#O!CW#O#P!Dy#P#o!=y#o#p!@c#p;'S!=y;'S;=`!Ek<%lO!=y<z!?Td$h&j!V7`O!^&c!_#W&c#W#X!>|#X#Z&c#Z#[!>|#[#]&c#]#^!>|#^#a&c#a#b!>|#b#g&c#g#h!>|#h#i&c#i#j!>|#j#k!>|#k#m&c#m#n!>|#n#o&c#p;'S&c;'S;=`&w<%lO&c7`!@hX!V7`OY!@cZ!P!@c!P!Q!AT!Q!}!@c!}#O!Ar#O#P!Bq#P;'S!@c;'S;=`!CQ<%lO!@c7`!AYW!V7`#W#X!AT#Z#[!AT#]#^!AT#a#b!AT#g#h!AT#i#j!AT#j#k!AT#m#n!AT7`!AuVOY!ArZ#O!Ar#O#P!B[#P#Q!@c#Q;'S!Ar;'S;=`!Bk<%lO!Ar7`!B_SOY!ArZ;'S!Ar;'S;=`!Bk<%lO!Ar7`!BnP;=`<%l!Ar7`!BtSOY!@cZ;'S!@c;'S;=`!CQ<%lO!@c7`!CTP;=`<%l!@c<z!C][$h&jOY!CWYZ&cZ!^!CW!^!_!Ar!_#O!CW#O#P!DR#P#Q!=y#Q#o!CW#o#p!Ar#p;'S!CW;'S;=`!Ds<%lO!CW<z!DWX$h&jOY!CWYZ&cZ!^!CW!^!_!Ar!_#o!CW#o#p!Ar#p;'S!CW;'S;=`!Ds<%lO!CW<z!DvP;=`<%l!CW<z!EOX$h&jOY!=yYZ&cZ!^!=y!^!_!@c!_#o!=y#o#p!@c#p;'S!=y;'S;=`!Ek<%lO!=y<z!EnP;=`<%l!=y>^!Ezl$h&j(X!b!V7`OY&}YZ&cZw&}wx&cx!^&}!^!_'}!_#O&}#O#P&c#P#W&}#W#X!Eq#X#Z&}#Z#[!Eq#[#]&}#]#^!Eq#^#a&}#a#b!Eq#b#g&}#g#h!Eq#h#i&}#i#j!Eq#j#k!Eq#k#m&}#m#n!Eq#n#o&}#o#p'}#p;'S&};'S;=`(l<%lO&}8r!GyZ(X!b!V7`OY!GrZw!Grwx!@cx!P!Gr!P!Q!Hl!Q!}!Gr!}#O!JU#O#P!Bq#P;'S!Gr;'S;=`!J|<%lO!Gr8r!Hse(X!b!V7`OY'}Zw'}x#O'}#P#W'}#W#X!Hl#X#Z'}#Z#[!Hl#[#]'}#]#^!Hl#^#a'}#a#b!Hl#b#g'}#g#h!Hl#h#i'}#i#j!Hl#j#k!Hl#k#m'}#m#n!Hl#n;'S'};'S;=`(f<%lO'}8r!JZX(X!bOY!JUZw!JUwx!Arx#O!JU#O#P!B[#P#Q!Gr#Q;'S!JU;'S;=`!Jv<%lO!JU8r!JyP;=`<%l!JU8r!KPP;=`<%l!Gr>^!KZ^$h&j(X!bOY!KSYZ&cZw!KSwx!CWx!^!KS!^!_!JU!_#O!KS#O#P!DR#P#Q!<n#Q#o!KS#o#p!JU#p;'S!KS;'S;=`!LV<%lO!KS>^!LYP;=`<%l!KS>^!L`P;=`<%l!<n=l!Ll`$h&j(Up!V7`OY!LcYZ&cZr!Lcrs!=ys!P!Lc!P!Q!Mn!Q!^!Lc!^!_# o!_!}!Lc!}#O#%P#O#P!Dy#P#o!Lc#o#p# o#p;'S!Lc;'S;=`#&Y<%lO!Lc=l!Mwl$h&j(Up!V7`OY(rYZ&cZr(rrs&cs!^(r!^!_)r!_#O(r#O#P&c#P#W(r#W#X!Mn#X#Z(r#Z#[!Mn#[#](r#]#^!Mn#^#a(r#a#b!Mn#b#g(r#g#h!Mn#h#i(r#i#j!Mn#j#k!Mn#k#m(r#m#n!Mn#n#o(r#o#p)r#p;'S(r;'S;=`*a<%lO(r8Q# vZ(Up!V7`OY# oZr# ors!@cs!P# o!P!Q#!i!Q!}# o!}#O#$R#O#P!Bq#P;'S# o;'S;=`#$y<%lO# o8Q#!pe(Up!V7`OY)rZr)rs#O)r#P#W)r#W#X#!i#X#Z)r#Z#[#!i#[#])r#]#^#!i#^#a)r#a#b#!i#b#g)r#g#h#!i#h#i)r#i#j#!i#j#k#!i#k#m)r#m#n#!i#n;'S)r;'S;=`*Z<%lO)r8Q#$WX(UpOY#$RZr#$Rrs!Ars#O#$R#O#P!B[#P#Q# o#Q;'S#$R;'S;=`#$s<%lO#$R8Q#$vP;=`<%l#$R8Q#$|P;=`<%l# o=l#%W^$h&j(UpOY#%PYZ&cZr#%Prs!CWs!^#%P!^!_#$R!_#O#%P#O#P!DR#P#Q!Lc#Q#o#%P#o#p#$R#p;'S#%P;'S;=`#&S<%lO#%P=l#&VP;=`<%l#%P=l#&]P;=`<%l!Lc?O#&kn$h&j(Up(X!b!V7`OY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#W%Z#W#X#&`#X#Z%Z#Z#[#&`#[#]%Z#]#^#&`#^#a%Z#a#b#&`#b#g%Z#g#h#&`#h#i%Z#i#j#&`#j#k#&`#k#m%Z#m#n#&`#n#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z9d#(r](Up(X!b!V7`OY#(iZr#(irs!Grsw#(iwx# ox!P#(i!P!Q#)k!Q!}#(i!}#O#+`#O#P!Bq#P;'S#(i;'S;=`#,`<%lO#(i9d#)th(Up(X!b!V7`OY*gZr*grs'}sw*gwx)rx#O*g#P#W*g#W#X#)k#X#Z*g#Z#[#)k#[#]*g#]#^#)k#^#a*g#a#b#)k#b#g*g#g#h#)k#h#i*g#i#j#)k#j#k#)k#k#m*g#m#n#)k#n;'S*g;'S;=`+Z<%lO*g9d#+gZ(Up(X!bOY#+`Zr#+`rs!JUsw#+`wx#$Rx#O#+`#O#P!B[#P#Q#(i#Q;'S#+`;'S;=`#,Y<%lO#+`9d#,]P;=`<%l#+`9d#,cP;=`<%l#(i?O#,o`$h&j(Up(X!bOY#,fYZ&cZr#,frs!KSsw#,fwx#%Px!^#,f!^!_#+`!_#O#,f#O#P!DR#P#Q!;Z#Q#o#,f#o#p#+`#p;'S#,f;'S;=`#-q<%lO#,f?O#-tP;=`<%l#,f?O#-zP;=`<%l!;Z07[#.[b$h&j(Up(X!b'|0/l!V7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z07[#/o_$h&j(Up(X!bT0/lOY#/dYZ&cZr#/drs#0nsw#/dwx#4Ox!^#/d!^!_#5}!_#O#/d#O#P#1p#P#o#/d#o#p#5}#p;'S#/d;'S;=`#6|<%lO#/d06j#0w]$h&j(X!bT0/lOY#0nYZ&cZw#0nwx#1px!^#0n!^!_#3R!_#O#0n#O#P#1p#P#o#0n#o#p#3R#p;'S#0n;'S;=`#3x<%lO#0n05W#1wX$h&jT0/lOY#1pYZ&cZ!^#1p!^!_#2d!_#o#1p#o#p#2d#p;'S#1p;'S;=`#2{<%lO#1p0/l#2iST0/lOY#2dZ;'S#2d;'S;=`#2u<%lO#2d0/l#2xP;=`<%l#2d05W#3OP;=`<%l#1p01O#3YW(X!bT0/lOY#3RZw#3Rwx#2dx#O#3R#O#P#2d#P;'S#3R;'S;=`#3r<%lO#3R01O#3uP;=`<%l#3R06j#3{P;=`<%l#0n05x#4X]$h&j(UpT0/lOY#4OYZ&cZr#4Ors#1ps!^#4O!^!_#5Q!_#O#4O#O#P#1p#P#o#4O#o#p#5Q#p;'S#4O;'S;=`#5w<%lO#4O00^#5XW(UpT0/lOY#5QZr#5Qrs#2ds#O#5Q#O#P#2d#P;'S#5Q;'S;=`#5q<%lO#5Q00^#5tP;=`<%l#5Q05x#5zP;=`<%l#4O01p#6WY(Up(X!bT0/lOY#5}Zr#5}rs#3Rsw#5}wx#5Qx#O#5}#O#P#2d#P;'S#5};'S;=`#6v<%lO#5}01p#6yP;=`<%l#5}07[#7PP;=`<%l#/d)3h#7ab$h&j$P(Ch(Up(X!b!V7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;ZAt#8vb$Y#t$h&j(Up(X!b!V7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z'Ad#:Zp$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!3Y!P!Q%Z!Q![#<_![!^%Z!^!_*g!_!g%Z!g!h!4|!h#O%Z#O#P&c#P#R%Z#R#S#<_#S#U%Z#U#V#?i#V#X%Z#X#Y!4|#Y#b%Z#b#c#>_#c#d#Bq#d#l%Z#l#m#Es#m#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#<jk$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!3Y!P!Q%Z!Q![#<_![!^%Z!^!_*g!_!g%Z!g!h!4|!h#O%Z#O#P&c#P#R%Z#R#S#<_#S#X%Z#X#Y!4|#Y#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#>j_$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#?rd$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!R#AQ!R!S#AQ!S!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#AQ#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#A]f$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!R#AQ!R!S#AQ!S!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#AQ#S#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#Bzc$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!Y#DV!Y!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#DV#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#Dbe$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!Y#DV!Y!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#DV#S#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#E|g$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![#Ge![!^%Z!^!_*g!_!c%Z!c!i#Ge!i#O%Z#O#P&c#P#R%Z#R#S#Ge#S#T%Z#T#Z#Ge#Z#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#Gpi$h&j(Up(X!bq'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![#Ge![!^%Z!^!_*g!_!c%Z!c!i#Ge!i#O%Z#O#P&c#P#R%Z#R#S#Ge#S#T%Z#T#Z#Ge#Z#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z*)x#Il_!e$b$h&j#})Lv(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z)[#Jv_al$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z04f#LS^h#)`#P-<U(Up(X!b$m7`OY*gZr*grs'}sw*gwx)rx!P*g!P!Q#MO!Q!^*g!^!_#Mt!_!`$ f!`#O*g#P;'S*g;'S;=`+Z<%lO*g(n#MXX$j&j(Up(X!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g(El#M}Z#p(Ch(Up(X!bOY*gZr*grs'}sw*gwx)rx!_*g!_!`#Np!`#O*g#P;'S*g;'S;=`+Z<%lO*g(El#NyX$P(Ch(Up(X!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g(El$ oX#q(Ch(Up(X!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g*)x$!ga#^*!Y$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`0z!`!a$#l!a#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(K[$#w_#i(Cl$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z*)x$%Vag!*r#q(Ch$e#|$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`$&[!`!a$'f!a#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$&g_#q(Ch$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$'qa#p(Ch$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`!a$(v!a#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$)R`#p(Ch$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(Kd$*`a(p(Ct$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!a%Z!a!b$+e!b#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$+p`$h&j#z(Ch(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z%#`$,}_!z$Ip$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z04f$.X_!Q0,v$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(n$/]Z$h&jO!^$0O!^!_$0f!_#i$0O#i#j$0k#j#l$0O#l#m$2^#m#o$0O#o#p$0f#p;'S$0O;'S;=`$4i<%lO$0O(n$0VT_#S$h&jO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c#S$0kO_#S(n$0p[$h&jO!Q&c!Q![$1f![!^&c!_!c&c!c!i$1f!i#T&c#T#Z$1f#Z#o&c#o#p$3|#p;'S&c;'S;=`&w<%lO&c(n$1kZ$h&jO!Q&c!Q![$2^![!^&c!_!c&c!c!i$2^!i#T&c#T#Z$2^#Z#o&c#p;'S&c;'S;=`&w<%lO&c(n$2cZ$h&jO!Q&c!Q![$3U![!^&c!_!c&c!c!i$3U!i#T&c#T#Z$3U#Z#o&c#p;'S&c;'S;=`&w<%lO&c(n$3ZZ$h&jO!Q&c!Q![$0O![!^&c!_!c&c!c!i$0O!i#T&c#T#Z$0O#Z#o&c#p;'S&c;'S;=`&w<%lO&c#S$4PR!Q![$4Y!c!i$4Y#T#Z$4Y#S$4]S!Q![$4Y!c!i$4Y#T#Z$4Y#q#r$0f(n$4lP;=`<%l$0O#1[$4z_!W#)l$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$6U`#w(Ch$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z+;p$7c_$h&j(Up(X!b(_+4QOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[$8qk$h&j(Up(X!b(R,2j$^#t(c$I[OY%ZYZ&cZr%Zrs&}st%Ztu$8buw%Zwx(rx}%Z}!O$:f!O!Q%Z!Q![$8b![!^%Z!^!_*g!_!c%Z!c!}$8b!}#O%Z#O#P&c#P#R%Z#R#S$8b#S#T%Z#T#o$8b#o#p*g#p$g%Z$g;'S$8b;'S;=`$<l<%lO$8b+d$:qk$h&j(Up(X!b$^#tOY%ZYZ&cZr%Zrs&}st%Ztu$:fuw%Zwx(rx}%Z}!O$:f!O!Q%Z!Q![$:f![!^%Z!^!_*g!_!c%Z!c!}$:f!}#O%Z#O#P&c#P#R%Z#R#S$:f#S#T%Z#T#o$:f#o#p*g#p$g%Z$g;'S$:f;'S;=`$<f<%lO$:f+d$<iP;=`<%l$:f07[$<oP;=`<%l$8b#Jf$<{X!]#Hb(Up(X!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g,#x$=sa(w+JY$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p#q$+e#q;'S%Z;'S;=`+a<%lO%Z)>v$?V_![(CdtBr$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z?O$@a_!o7`$h&j(Up(X!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[$Aq|$h&j(Up(X!b'z0/l$[#t(R,2j(c$I[OX%ZXY+gYZ&cZ[+g[p%Zpq+gqr%Zrs&}st%ZtuEruw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Er![!^%Z!^!_*g!_!c%Z!c!}Er!}#O%Z#O#P&c#P#R%Z#R#SEr#S#T%Z#T#oEr#o#p*g#p$f%Z$f$g+g$g#BYEr#BY#BZ$A`#BZ$ISEr$IS$I_$A`$I_$JTEr$JT$JU$A`$JU$KVEr$KV$KW$A`$KW&FUEr&FU&FV$A`&FV;'SEr;'S;=`I|<%l?HTEr?HT?HU$A`?HUOEr07[$D|k$h&j(Up(X!b'{0/l$[#t(R,2j(c$I[OY%ZYZ&cZr%Zrs&}st%ZtuEruw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Er![!^%Z!^!_*g!_!c%Z!c!}Er!}#O%Z#O#P&c#P#R%Z#R#SEr#S#T%Z#T#oEr#o#p*g#p$g%Z$g;'SEr;'S;=`I|<%lOEr",
  tokenizers: [noSemicolon, noSemicolonType, operatorToken, jsx, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, insertSemicolon, new LocalTokenGroup("$S~RRtu[#O#Pg#S#T#|~_P#o#pb~gOv~~jVO#i!P#i#j!U#j#l!P#l#m!q#m;'S!P;'S;=`#v<%lO!P~!UO!S~~!XS!Q![!e!c!i!e#T#Z!e#o#p#Z~!hR!Q![!q!c!i!q#T#Z!q~!tR!Q![!}!c!i!}#T#Z!}~#QR!Q![!P!c!i!P#T#Z!P~#^R!Q![#g!c!i#g#T#Z#g~#jS!Q![#g!c!i#g#T#Z#g#q#r!P~#yP;=`<%l!P~$RO(a~~", 141, 338), new LocalTokenGroup("j~RQYZXz{^~^O(O~~aP!P!Qd~iO(P~~", 25, 321)],
  topRules: {"Script":[0,7],"SingleExpression":[1,274],"SingleClassItem":[2,275]},
  dialects: {jsx: 0, ts: 15091},
  dynamicPrecedences: {"78":1,"80":1,"92":1,"168":1,"198":1},
  specialized: [{term: 325, get: (value) => spec_identifier$1[value] || -1},{term: 341, get: (value) => spec_word[value] || -1},{term: 93, get: (value) => spec_LessThan[value] || -1}],
  tokenPrec: 15116
});

/**
A collection of JavaScript-related
[snippets](https://codemirror.net/6/docs/ref/#autocomplete.snippet).
*/
const snippets = [
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("function ${name}(${params}) {\n\t${}\n}", {
        label: "function",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("for (let ${index} = 0; ${index} < ${bound}; ${index}++) {\n\t${}\n}", {
        label: "for",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("for (let ${name} of ${collection}) {\n\t${}\n}", {
        label: "for",
        detail: "of loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("do {\n\t${}\n} while (${})", {
        label: "do",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("while (${}) {\n\t${}\n}", {
        label: "while",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("try {\n\t${}\n} catch (${error}) {\n\t${}\n}", {
        label: "try",
        detail: "/ catch block",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("if (${}) {\n\t${}\n}", {
        label: "if",
        detail: "block",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("if (${}) {\n\t${}\n} else {\n\t${}\n}", {
        label: "if",
        detail: "/ else block",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("class ${name} {\n\tconstructor(${params}) {\n\t\t${}\n\t}\n}", {
        label: "class",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("import {${names}} from \"${module}\"\n${}", {
        label: "import",
        detail: "named",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("import ${name} from \"${module}\"\n${}", {
        label: "import",
        detail: "default",
        type: "keyword"
    })
];
/**
A collection of snippet completions for TypeScript. Includes the
JavaScript [snippets](https://codemirror.net/6/docs/ref/#lang-javascript.snippets).
*/
const typescriptSnippets = /*@__PURE__*/snippets.concat([
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("interface ${name} {\n\t${}\n}", {
        label: "interface",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("type ${name} = ${type}", {
        label: "type",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_v6_lib.snippetCompletion("enum ${name} {\n\t${}\n}", {
        label: "enum",
        detail: "definition",
        type: "keyword"
    })
]);

const cache = /*@__PURE__*/new NodeWeakMap();
const ScopeNodes = /*@__PURE__*/new Set([
    "Script", "Block",
    "FunctionExpression", "FunctionDeclaration", "ArrowFunction", "MethodDeclaration",
    "ForStatement"
]);
function defID(type) {
    return (node, def) => {
        let id = node.node.getChild("VariableDefinition");
        if (id)
            def(id, type);
        return true;
    };
}
const functionContext = ["FunctionDeclaration"];
const gatherCompletions = {
    FunctionDeclaration: /*@__PURE__*/defID("function"),
    ClassDeclaration: /*@__PURE__*/defID("class"),
    ClassExpression: () => true,
    EnumDeclaration: /*@__PURE__*/defID("constant"),
    TypeAliasDeclaration: /*@__PURE__*/defID("type"),
    NamespaceDeclaration: /*@__PURE__*/defID("namespace"),
    VariableDefinition(node, def) { if (!node.matchContext(functionContext))
        def(node, "variable"); },
    TypeDefinition(node, def) { def(node, "type"); },
    __proto__: null
};
function getScope(doc, node) {
    let cached = cache.get(node);
    if (cached)
        return cached;
    let completions = [], top = true;
    function def(node, type) {
        let name = doc.sliceString(node.from, node.to);
        completions.push({ label: name, type });
    }
    node.cursor(exports.IterMode.IncludeAnonymous).iterate(node => {
        if (top) {
            top = false;
        }
        else if (node.name) {
            let gather = gatherCompletions[node.name];
            if (gather && gather(node, def) || ScopeNodes.has(node.name))
                return false;
        }
        else if (node.to - node.from > 8192) {
            // Allow caching for bigger internal nodes
            for (let c of getScope(doc, node.node))
                completions.push(c);
            return false;
        }
    });
    cache.set(node, completions);
    return completions;
}
const Identifier = /^[\w$\xa1-\uffff][\w$\d\xa1-\uffff]*$/;
const dontComplete = [
    "TemplateString", "String", "RegExp",
    "LineComment", "BlockComment",
    "VariableDefinition", "TypeDefinition", "Label",
    "PropertyDefinition", "PropertyName",
    "PrivatePropertyDefinition", "PrivatePropertyName",
    ".", "?."
];
/**
Completion source that looks up locally defined names in
JavaScript code.
*/
function localCompletionSource(context) {
    let inner = ext_CodeMirror_v6_lib.syntaxTree(context.state).resolveInner(context.pos, -1);
    if (dontComplete.indexOf(inner.name) > -1)
        return null;
    let isWord = inner.name == "VariableName" ||
        inner.to - inner.from < 20 && Identifier.test(context.state.sliceDoc(inner.from, inner.to));
    if (!isWord && !context.explicit)
        return null;
    let options = [];
    for (let pos = inner; pos; pos = pos.parent) {
        if (ScopeNodes.has(pos.name))
            options = options.concat(getScope(context.state.doc, pos));
    }
    return {
        options,
        from: isWord ? inner.from : context.pos,
        validFor: Identifier
    };
}
function pathFor(read, member, name) {
    var _a;
    let path = [];
    for (;;) {
        let obj = member.firstChild, prop;
        if ((obj === null || obj === void 0 ? void 0 : obj.name) == "VariableName") {
            path.push(read(obj));
            return { path: path.reverse(), name };
        }
        else if ((obj === null || obj === void 0 ? void 0 : obj.name) == "MemberExpression" && ((_a = (prop = obj.lastChild)) === null || _a === void 0 ? void 0 : _a.name) == "PropertyName") {
            path.push(read(prop));
            member = obj;
        }
        else {
            return null;
        }
    }
}
/**
Helper function for defining JavaScript completion sources. It
returns the completable name and object path for a completion
context, or null if no name/property completion should happen at
that position. For example, when completing after `a.b.c` it will
return `{path: ["a", "b"], name: "c"}`. When completing after `x`
it will return `{path: [], name: "x"}`. When not in a property or
name, it will return null if `context.explicit` is false, and
`{path: [], name: ""}` otherwise.
*/
function completionPath(context) {
    let read = (node) => context.state.doc.sliceString(node.from, node.to);
    let inner = ext_CodeMirror_v6_lib.syntaxTree(context.state).resolveInner(context.pos, -1);
    if (inner.name == "PropertyName") {
        return pathFor(read, inner.parent, read(inner));
    }
    else if ((inner.name == "." || inner.name == "?.") && inner.parent.name == "MemberExpression") {
        return pathFor(read, inner.parent, "");
    }
    else if (dontComplete.indexOf(inner.name) > -1) {
        return null;
    }
    else if (inner.name == "VariableName" || inner.to - inner.from < 20 && Identifier.test(read(inner))) {
        return { path: [], name: read(inner) };
    }
    else if (inner.name == "MemberExpression") {
        return pathFor(read, inner, "");
    }
    else {
        return context.explicit ? { path: [], name: "" } : null;
    }
}
function enumeratePropertyCompletions(obj, top) {
    let options = [], seen = new Set;
    for (let depth = 0;; depth++) {
        for (let name of (Object.getOwnPropertyNames || Object.keys)(obj)) {
            if (!/^[a-zA-Z_$\xaa-\uffdc][\w$\xaa-\uffdc]*$/.test(name) || seen.has(name))
                continue;
            seen.add(name);
            let value;
            try {
                value = obj[name];
            }
            catch (_) {
                continue;
            }
            options.push({
                label: name,
                type: typeof value == "function" ? (/^[A-Z]/.test(name) ? "class" : top ? "function" : "method")
                    : top ? "variable" : "property",
                boost: -depth
            });
        }
        let next = Object.getPrototypeOf(obj);
        if (!next)
            return options;
        obj = next;
    }
}
/**
Defines a [completion source](https://codemirror.net/6/docs/ref/#autocomplete.CompletionSource) that
completes from the given scope object (for example `globalThis`).
Will enter properties of the object when completing properties on
a directly-named path.
*/
function scopeCompletionSource(scope) {
    let cache = new Map;
    return (context) => {
        let path = completionPath(context);
        if (!path)
            return null;
        let target = scope;
        for (let step of path.path) {
            target = target[step];
            if (!target)
                return null;
        }
        let options = cache.get(target);
        if (!options)
            cache.set(target, options = enumeratePropertyCompletions(target, !path.path.length));
        return {
            from: context.pos - path.name.length,
            options,
            validFor: Identifier
        };
    };
}

/**
A language provider based on the [Lezer JavaScript
parser](https://github.com/lezer-parser/javascript), extended with
highlighting and indentation information.
*/
const javascriptLanguage = /*@__PURE__*/ext_CodeMirror_v6_lib.LRLanguage.define({
    name: "javascript",
    parser: /*@__PURE__*/parser$4.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_v6_lib.indentNodeProp.add({
                IfStatement: /*@__PURE__*/ext_CodeMirror_v6_lib.continuedIndent({ except: /^\s*({|else\b)/ }),
                TryStatement: /*@__PURE__*/ext_CodeMirror_v6_lib.continuedIndent({ except: /^\s*({|catch\b|finally\b)/ }),
                LabeledStatement: ext_CodeMirror_v6_lib.flatIndent,
                SwitchBody: context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
                },
                Block: /*@__PURE__*/ext_CodeMirror_v6_lib.delimitedIndent({ closing: "}" }),
                ArrowFunction: cx => cx.baseIndent + cx.unit,
                "TemplateString BlockComment": () => null,
                "Statement Property": /*@__PURE__*/ext_CodeMirror_v6_lib.continuedIndent({ except: /^{/ }),
                JSXElement(context) {
                    let closed = /^\s*<\//.test(context.textAfter);
                    return context.lineIndent(context.node.from) + (closed ? 0 : context.unit);
                },
                JSXEscape(context) {
                    let closed = /\s*\}/.test(context.textAfter);
                    return context.lineIndent(context.node.from) + (closed ? 0 : context.unit);
                },
                "JSXOpenTag JSXSelfClosingTag"(context) {
                    return context.column(context.node.from) + context.unit;
                }
            }),
            /*@__PURE__*/ext_CodeMirror_v6_lib.foldNodeProp.add({
                "Block ClassBody SwitchBody EnumBody ObjectExpression ArrayExpression ObjectType": ext_CodeMirror_v6_lib.foldInside,
                BlockComment(tree) { return { from: tree.from + 2, to: tree.to - 2 }; }
            })
        ]
    }),
    languageData: {
        closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
        commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*(?:case |default:|\{|\}|<\/)$/,
        wordChars: "$"
    }
});
const jsxSublanguage = {
    test: node => /^JSX/.test(node.name),
    facet: /*@__PURE__*/ext_CodeMirror_v6_lib.defineLanguageFacet({ commentTokens: { block: { open: "{/*", close: "*/}" } } })
};
/**
A language provider for TypeScript.
*/
const typescriptLanguage = /*@__PURE__*/javascriptLanguage.configure({ dialect: "ts" }, "typescript");
/**
Language provider for JSX.
*/
const jsxLanguage = /*@__PURE__*/javascriptLanguage.configure({
    dialect: "jsx",
    props: [/*@__PURE__*/ext_CodeMirror_v6_lib.sublanguageProp.add(n => n.isTop ? [jsxSublanguage] : undefined)]
});
/**
Language provider for JSX + TypeScript.
*/
const tsxLanguage = /*@__PURE__*/javascriptLanguage.configure({
    dialect: "jsx ts",
    props: [/*@__PURE__*/ext_CodeMirror_v6_lib.sublanguageProp.add(n => n.isTop ? [jsxSublanguage] : undefined)]
}, "typescript");
let kwCompletion = (name) => ({ label: name, type: "keyword" });
const keywords$1 = /*@__PURE__*/"break case const continue default delete export extends false finally in instanceof let new return static super switch this throw true typeof var yield".split(" ").map(kwCompletion);
const typescriptKeywords = /*@__PURE__*/keywords$1.concat(/*@__PURE__*/["declare", "implements", "private", "protected", "public"].map(kwCompletion));
/**
JavaScript support. Includes [snippet](https://codemirror.net/6/docs/ref/#lang-javascript.snippets)
and local variable completion.
*/
function javascript(config = {}) {
    let lang = config.jsx ? (config.typescript ? tsxLanguage : jsxLanguage)
        : config.typescript ? typescriptLanguage : javascriptLanguage;
    let completions = config.typescript ? typescriptSnippets.concat(typescriptKeywords) : snippets.concat(keywords$1);
    return new ext_CodeMirror_v6_lib.LanguageSupport(lang, [
        javascriptLanguage.data.of({
            autocomplete: ext_CodeMirror_v6_lib.ifNotIn(dontComplete, ext_CodeMirror_v6_lib.completeFromList(completions))
        }),
        javascriptLanguage.data.of({
            autocomplete: localCompletionSource
        }),
        config.jsx ? autoCloseTags$1 : [],
    ]);
}
function findOpenTag(node) {
    for (;;) {
        if (node.name == "JSXOpenTag" || node.name == "JSXSelfClosingTag" || node.name == "JSXFragmentTag")
            return node;
        if (node.name == "JSXEscape" || !node.parent)
            return null;
        node = node.parent;
    }
}
function elementName$1(doc, tree, max = doc.length) {
    for (let ch = tree === null || tree === void 0 ? void 0 : tree.firstChild; ch; ch = ch.nextSibling) {
        if (ch.name == "JSXIdentifier" || ch.name == "JSXBuiltin" || ch.name == "JSXNamespacedName" ||
            ch.name == "JSXMemberExpression")
            return doc.sliceString(ch.from, Math.min(ch.to, max));
    }
    return "";
}
const android = typeof navigator == "object" && /*@__PURE__*//Android\b/.test(navigator.userAgent);
/**
Extension that will automatically insert JSX close tags when a `>` or
`/` is typed.
*/
const autoCloseTags$1 = /*@__PURE__*/ext_CodeMirror_v6_lib.EditorView.inputHandler.of((view, from, to, text, defaultInsert) => {
    if ((android ? view.composing : view.compositionStarted) || view.state.readOnly ||
        from != to || (text != ">" && text != "/") ||
        !javascriptLanguage.isActiveAt(view.state, from, -1))
        return false;
    let base = defaultInsert(), { state } = base;
    let closeTags = state.changeByRange(range => {
        var _a;
        let { head } = range, around = ext_CodeMirror_v6_lib.syntaxTree(state).resolveInner(head - 1, -1), name;
        if (around.name == "JSXStartTag")
            around = around.parent;
        if (state.doc.sliceString(head - 1, head) != text || around.name == "JSXAttributeValue" && around.to > head) ;
        else if (text == ">" && around.name == "JSXFragmentTag") {
            return { range, changes: { from: head, insert: `</>` } };
        }
        else if (text == "/" && around.name == "JSXStartCloseTag") {
            let empty = around.parent, base = empty.parent;
            if (base && empty.from == head - 2 &&
                ((name = elementName$1(state.doc, base.firstChild, head)) || ((_a = base.firstChild) === null || _a === void 0 ? void 0 : _a.name) == "JSXFragmentTag")) {
                let insert = `${name}>`;
                return { range: ext_CodeMirror_v6_lib.EditorSelection.cursor(head + insert.length, -1), changes: { from: head, insert } };
            }
        }
        else if (text == ">") {
            let openTag = findOpenTag(around);
            if (openTag && openTag.name == "JSXOpenTag" &&
                !/^\/?>|^<\//.test(state.doc.sliceString(head, head + 2)) &&
                (name = elementName$1(state.doc, openTag, head)))
                return { range, changes: { from: head, insert: `</${name}>` } };
        }
        return { range };
    });
    if (closeTags.changes.empty)
        return false;
    view.dispatch([
        base,
        state.update(closeTags, { userEvent: "input.complete", scrollIntoView: true })
    ]);
    return true;
});

/**
Connects an [ESLint](https://eslint.org/) linter to CodeMirror's
[lint](https://codemirror.net/6/docs/ref/#lint) integration. `eslint` should be an instance of the
[`Linter`](https://eslint.org/docs/developer-guide/nodejs-api#linter)
class, and `config` an optional ESLint configuration. The return
value of this function can be passed to [`linter`](https://codemirror.net/6/docs/ref/#lint.linter)
to create a JavaScript linting extension.

Note that ESLint targets node, and is tricky to run in the
browser. The
[eslint-linter-browserify](https://github.com/UziTech/eslint-linter-browserify)
package may help with that (see
[example](https://github.com/UziTech/eslint-linter-browserify/blob/master/example/script.js)).
*/
function esLint(eslint, config) {
    if (!config) {
        config = {
            parserOptions: { ecmaVersion: 2019, sourceType: "module" },
            env: { browser: true, node: true, es6: true, es2015: true, es2017: true, es2020: true },
            rules: {}
        };
        eslint.getRules().forEach((desc, name) => {
            if (desc.meta.docs.recommended)
                config.rules[name] = 2;
        });
    }
    return (view) => {
        let { state } = view, found = [];
        for (let { from, to } of javascriptLanguage.findRegions(state)) {
            let fromLine = state.doc.lineAt(from), offset = { line: fromLine.number - 1, col: from - fromLine.from, pos: from };
            for (let d of eslint.verify(state.sliceDoc(from, to), config))
                found.push(translateDiagnostic(d, state.doc, offset));
        }
        return found;
    };
}
function mapPos(line, col, doc, offset) {
    return doc.line(line + offset.line).from + col + (line == 1 ? offset.col - 1 : -1);
}
function translateDiagnostic(input, doc, offset) {
    let start = mapPos(input.line, input.column, doc, offset);
    let result = {
        from: start,
        to: input.endLine != null && input.endColumn != 1 ? mapPos(input.endLine, input.endColumn, doc, offset) : start,
        message: input.message,
        source: input.ruleId ? "eslint:" + input.ruleId : "eslint",
        severity: input.severity == 1 ? "warning" : "error",
    };
    if (input.fix) {
        let { range, text } = input.fix, from = range[0] + offset.pos - start, to = range[1] + offset.pos - start;
        result.actions = [{
                name: "fix",
                apply(view, start) {
                    view.dispatch({ changes: { from: start + from, to: start + to, insert: text }, scrollIntoView: true });
                }
            }];
    }
    return result;
}

// This file was generated by lezer-generator. You probably shouldn't edit it.
const descendantOp = 100,
  Unit = 1,
  callee = 101,
  identifier$2 = 102,
  VariableName = 2;

/* Hand-written tokenizers for CSS tokens that can't be
   expressed by Lezer's built-in tokenizer. */

const space = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
               8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288];
const colon = 58, parenL = 40, underscore = 95, bracketL = 91, dash$1 = 45, period = 46,
      hash = 35, percent = 37, ampersand = 38, backslash = 92, newline = 10;

function isAlpha(ch) { return ch >= 65 && ch <= 90 || ch >= 97 && ch <= 122 || ch >= 161 }

function isDigit(ch) { return ch >= 48 && ch <= 57 }

const identifiers = new ExternalTokenizer((input, stack) => {
  for (let inside = false, dashes = 0, i = 0;; i++) {
    let {next} = input;
    if (isAlpha(next) || next == dash$1 || next == underscore || (inside && isDigit(next))) {
      if (!inside && (next != dash$1 || i > 0)) inside = true;
      if (dashes === i && next == dash$1) dashes++;
      input.advance();
    } else if (next == backslash && input.peek(1) != newline) {
      input.advance();
      if (input.next > -1) input.advance();
      inside = true;
    } else {
      if (inside)
        input.acceptToken(next == parenL ? callee : dashes == 2 && stack.canShift(VariableName) ? VariableName : identifier$2);
      break
    }
  }
});

const descendant = new ExternalTokenizer(input => {
  if (space.includes(input.peek(-1))) {
    let {next} = input;
    if (isAlpha(next) || next == underscore || next == hash || next == period ||
        next == bracketL || next == colon && isAlpha(input.peek(1)) ||
        next == dash$1 || next == ampersand)
      input.acceptToken(descendantOp);
  }
});

const unitToken = new ExternalTokenizer(input => {
  if (!space.includes(input.peek(-1))) {
    let {next} = input;
    if (next == percent) { input.advance(); input.acceptToken(Unit); }
    if (isAlpha(next)) {
      do { input.advance(); } while (isAlpha(input.next) || isDigit(input.next))
      input.acceptToken(Unit);
    }
  }
});

const cssHighlighting = ext_CodeMirror_v6_lib.styleTags({
  "AtKeyword import charset namespace keyframes media supports": ext_CodeMirror_v6_lib.tags.definitionKeyword,
  "from to selector": ext_CodeMirror_v6_lib.tags.keyword,
  NamespaceName: ext_CodeMirror_v6_lib.tags.namespace,
  KeyframeName: ext_CodeMirror_v6_lib.tags.labelName,
  KeyframeRangeName: ext_CodeMirror_v6_lib.tags.operatorKeyword,
  TagName: ext_CodeMirror_v6_lib.tags.tagName,
  ClassName: ext_CodeMirror_v6_lib.tags.className,
  PseudoClassName: ext_CodeMirror_v6_lib.tags.constant(ext_CodeMirror_v6_lib.tags.className),
  IdName: ext_CodeMirror_v6_lib.tags.labelName,
  "FeatureName PropertyName": ext_CodeMirror_v6_lib.tags.propertyName,
  AttributeName: ext_CodeMirror_v6_lib.tags.attributeName,
  NumberLiteral: ext_CodeMirror_v6_lib.tags.number,
  KeywordQuery: ext_CodeMirror_v6_lib.tags.keyword,
  UnaryQueryOp: ext_CodeMirror_v6_lib.tags.operatorKeyword,
  "CallTag ValueName": ext_CodeMirror_v6_lib.tags.atom,
  VariableName: ext_CodeMirror_v6_lib.tags.variableName,
  Callee: ext_CodeMirror_v6_lib.tags.operatorKeyword,
  Unit: ext_CodeMirror_v6_lib.tags.unit,
  "UniversalSelector NestingSelector": ext_CodeMirror_v6_lib.tags.definitionOperator,
  MatchOp: ext_CodeMirror_v6_lib.tags.compareOperator,
  "ChildOp SiblingOp, LogicOp": ext_CodeMirror_v6_lib.tags.logicOperator,
  BinOp: ext_CodeMirror_v6_lib.tags.arithmeticOperator,
  Important: ext_CodeMirror_v6_lib.tags.modifier,
  Comment: ext_CodeMirror_v6_lib.tags.blockComment,
  ColorLiteral: ext_CodeMirror_v6_lib.tags.color,
  "ParenthesizedContent StringLiteral": ext_CodeMirror_v6_lib.tags.string,
  ":": ext_CodeMirror_v6_lib.tags.punctuation,
  "PseudoOp #": ext_CodeMirror_v6_lib.tags.derefOperator,
  "; ,": ext_CodeMirror_v6_lib.tags.separator,
  "( )": ext_CodeMirror_v6_lib.tags.paren,
  "[ ]": ext_CodeMirror_v6_lib.tags.squareBracket,
  "{ }": ext_CodeMirror_v6_lib.tags.brace
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const spec_callee = {__proto__:null,lang:34, "nth-child":34, "nth-last-child":34, "nth-of-type":34, "nth-last-of-type":34, dir:34, "host-context":34, url:62, "url-prefix":62, domain:62, regexp:62, selector:140};
const spec_AtKeyword = {__proto__:null,"@import":120, "@media":144, "@charset":148, "@namespace":152, "@keyframes":158, "@supports":170};
const spec_identifier = {__proto__:null,not:134, only:134};
const parser$3 = LRParser.deserialize({
  version: 14,
  states: ":jQYQ[OOO#_Q[OOP#fOWOOOOQP'#Cd'#CdOOQP'#Cc'#CcO#kQ[O'#CfO$_QXO'#CaO$fQ[O'#CiO$qQ[O'#DUO$vQ[O'#DXOOQP'#En'#EnO${QdO'#DhO%jQ[O'#DuO${QdO'#DwO%{Q[O'#DyO&WQ[O'#D|O&`Q[O'#ESO&nQ[O'#EUOOQS'#Em'#EmOOQS'#EX'#EXQYQ[OOO&uQXO'#CdO'jQWO'#DdO'oQWO'#EsO'zQ[O'#EsQOQWOOP(UO#tO'#C_POOO)C@])C@]OOQP'#Ch'#ChOOQP,59Q,59QO#kQ[O,59QO(aQ[O'#E]O({QWO,58{O)TQ[O,59TO$qQ[O,59pO$vQ[O,59sO(aQ[O,59vO(aQ[O,59xO(aQ[O,59yO)`Q[O'#DcOOQS,58{,58{OOQP'#Cl'#ClOOQO'#DS'#DSOOQP,59T,59TO)gQWO,59TO)lQWO,59TOOQP'#DW'#DWOOQP,59p,59pOOQO'#DY'#DYO)qQ`O,59sOOQS'#Cq'#CqO${QdO'#CrO)yQvO'#CtO+ZQtO,5:SOOQO'#Cy'#CyO)lQWO'#CxO+oQWO'#CzO+tQ[O'#DPOOQS'#Ep'#EpOOQO'#Dk'#DkO+|Q[O'#DrO,[QWO'#EtO&`Q[O'#DpO,jQWO'#DsOOQO'#Eu'#EuO)OQWO,5:aO,oQpO,5:cOOQS'#D{'#D{O,wQWO,5:eO,|Q[O,5:eOOQO'#EO'#EOO-UQWO,5:hO-ZQWO,5:nO-cQWO,5:pOOQS-E8V-E8VO-kQdO,5:OO-{Q[O'#E_O.YQWO,5;_O.YQWO,5;_POOO'#EW'#EWP.eO#tO,58yPOOO,58y,58yOOQP1G.l1G.lO/[QXO,5:wOOQO-E8Z-E8ZOOQS1G.g1G.gOOQP1G.o1G.oO)gQWO1G.oO)lQWO1G.oOOQP1G/[1G/[O/iQ`O1G/_O0SQXO1G/bO0jQXO1G/dO1QQXO1G/eO1hQWO,59}O1mQ[O'#DTO1tQdO'#CpOOQP1G/_1G/_O${QdO1G/_O1{QpO,59^OOQS,59`,59`O${QdO,59bO2TQWO1G/nOOQS,59d,59dO2YQ!bO,59fOOQS'#DQ'#DQOOQS'#EZ'#EZO2eQ[O,59kOOQS,59k,59kO2mQWO'#DkO2xQWO,5:WO2}QWO,5:^O&`Q[O,5:YO&`Q[O'#E`O3VQWO,5;`O3bQWO,5:[O(aQ[O,5:_OOQS1G/{1G/{OOQS1G/}1G/}OOQS1G0P1G0PO3sQWO1G0PO3xQdO'#EPOOQS1G0S1G0SOOQS1G0Y1G0YOOQS1G0[1G0[O4TQtO1G/jOOQO1G/j1G/jOOQO,5:y,5:yO4kQ[O,5:yOOQO-E8]-E8]O4xQWO1G0yPOOO-E8U-E8UPOOO1G.e1G.eOOQP7+$Z7+$ZOOQP7+$y7+$yO${QdO7+$yOOQS1G/i1G/iO5TQXO'#ErO5[QWO,59oO5aQtO'#EYO6XQdO'#EoO6cQWO,59[O6hQpO7+$yOOQS1G.x1G.xOOQS1G.|1G.|OOQS7+%Y7+%YOOQS1G/Q1G/QO6pQWO1G/QOOQS-E8X-E8XOOQS1G/V1G/VO${QdO1G/rOOQO1G/x1G/xOOQO1G/t1G/tO6uQWO,5:zOOQO-E8^-E8^O7TQXO1G/yOOQS7+%k7+%kO7[QYO'#CtOOQO'#ER'#ERO7gQ`O'#EQOOQO'#EQ'#EQO7rQWO'#EaO7zQdO,5:kOOQS,5:k,5:kO8VQtO'#E^O${QdO'#E^O9WQdO7+%UOOQO7+%U7+%UOOQO1G0e1G0eO9kQpO<<HeO9sQWO,5;^OOQP1G/Z1G/ZOOQS-E8W-E8WO${QdO'#E[O9{QWO,5;ZOOQT1G.v1G.vOOQP<<He<<HeOOQS7+$l7+$lO:TQdO7+%^OOQO7+%e7+%eOOQO,5:l,5:lO3{QdO'#EbO7rQWO,5:{OOQS,5:{,5:{OOQS-E8_-E8_OOQS1G0V1G0VO:[QtO,5:xOOQS-E8[-E8[OOQO<<Hp<<HpOOQPAN>PAN>PO;]QdO,5:vOOQO-E8Y-E8YOOQO<<Hx<<HxOOQO,5:|,5:|OOQO-E8`-E8`OOQS1G0g1G0g",
  stateData: ";o~O#[OS#]QQ~OUYOXYOZTO^VO_VOrXOyWO!]aO!^ZO!j[O!l]O!n^O!q_O!w`O#YRO~OQfOUYOXYOZTO^VO_VOrXOyWO!]aO!^ZO!j[O!l]O!n^O!q_O!w`O#YeO~O#V#gP~P!ZO#]jO~O#YlO~OZnO^qO_qOrsOuoOyrO!PtO!SvO#WuO~O!UwO~P#pOa}O#XzO#YyO~O#Y!OO~O#Y!QO~OQ![Oc!TOg![Oi![Oo!YOr!ZO#X!WO#Y!SO#e!UO~Oc!^O!e!`O!h!aO#Y!]O!U#hP~Oi!fOo!YO#Y!eO~Oi!hO#Y!hO~Oc!^O!e!`O!h!aO#Y!]O~O!Z#hP~P%jOZWX^WX^!XX_WXrWXuWXyWX!PWX!SWX!UWX#WWX~O^!mO~O!Z!nO#V#gX!T#gX~O#V#gX!T#gX~P!ZO#^!qO#_!qO#`!sO~OUYOXYOZTO^VO_VOrXOyWO#YRO~OuoO!UwO~Oa!zO#XzO#YyO~O!T#gP~P!ZOc#RO~Oc#SO~Oq#TO}#UO~OP#WOchXkhX!ZhX!ehX!hhX#YhXbhXQhXghXihXohXrhXuhX!YhX#VhX#XhX#ehXqhX!ThX~Oc!^Ok#XO!e!`O!h!aO#Y!]O!Z#hP~Oc#[O~Oq#`O#Y#]O~Oc!^O!e!`O!h!aO#Y#aO~Ou#eO!c#dO!U#hX!Z#hX~Oc#hO~Ok#XO!Z#jO~O!Z#kO~Oi#lOo!YO~O!U#mO~O!UwO!c#dO~O!UwO!Z#pO~O!Y#rO!Z!Wa#V!Wa!T!Wa~P${O!Z#RX#V#RX!T#RX~P!ZO!Z!nO#V#ga!T#ga~O#^!qO#_!qO#`#xO~OZnO^qO_qOrsOyrO!PtO!SvO#WuO~Ou#Pa!U#Pab#Pa~P.pOq#zO}#{O~OZnO^qO_qOrsOyrO~Ou!Oi!P!Oi!S!Oi!U!Oi#W!Oib!Oi~P/qOu!Qi!P!Qi!S!Qi!U!Qi#W!Qib!Qi~P/qOu!Ri!P!Ri!S!Ri!U!Ri#W!Rib!Ri~P/qO!T#|O~Ob#fP~P(aOb#cP~P${Ob$TOk#XO~O!Z$VO~Ob$WOi$XOp$XO~Oq$ZO#Y#]O~O^!aXb!_X!c!_X~O^$[O~Ob$]O!c#dO~Ou#eO!U#ha!Z#ha~O!c#dOu!da!U!da!Z!dab!da~O!Z$bO~O!T$iO#Y$dO#e$cO~Ok#XOu$kO!Y$mO!Z!Wi#V!Wi!T!Wi~P${O!Z#Ra#V#Ra!T#Ra~P!ZO!Z!nO#V#gi!T#gi~Ob#fX~P#pOb$qO~Ok#XOQ!|Xb!|Xc!|Xg!|Xi!|Xo!|Xr!|Xu!|X#X!|X#Y!|X#e!|X~Ou$sOb#cX~P${Ob$uO~Ok#XOq$vO~Ob$wO~O!c#dOu#Sa!U#Sa!Z#Sa~Ob$yO~P.pOP#WOuhX!UhX~O#e$cOu!tX!U!tX~Ou${O!UwO~O!T%PO#Y$dO#e$cO~Ok#XOQ#QXc#QXg#QXi#QXo#QXr#QXu#QX!Y#QX!Z#QX#V#QX#X#QX#Y#QX#e#QX!T#QX~Ou$kO!Y%SO!Z!Wq#V!Wq!T!Wq~P${Ok#XOq%TO~OuoOb#fa~Ou$sOb#ca~Ob%WO~P${Ok#XOQ#Qac#Qag#Qai#Qao#Qar#Qau#Qa!Y#Qa!Z#Qa#V#Qa#X#Qa#Y#Qa#e#Qa!T#Qa~Ob#Oau#Oa~P${O#[p#]#ek!S#e~",
  goto: "-g#jPPP#kP#nP#w$WP#wP$g#wPP$mPPP$s$|$|P%`P$|P$|%z&^PPPP$|&vP&z'Q#wP'W#w'^P#wP#w#wPPP'd'y(WPP#nPP(_(_(i(_P(_P(_(_P#nP#nP#nP(l#nP(o(r(u(|#nP#nP)R)X)h)v)|*S*^*d*n*t*zPPPPPPPPPP+Q+Z+v+yP,o,r,x-RRkQ_bOPdhw!n#tkYOPdhotuvw!n#R#h#tkSOPdhotuvw!n#R#h#tQmTR!tnQ{VR!xqQ!x}Q#Z!XR#y!zq![Z]!T!m#S#U#X#q#{$Q$[$k$l$s$x%Up![Z]!T!m#S#U#X#q#{$Q$[$k$l$s$x%UU$f#m$h${R$z$eq!XZ]!T!m#S#U#X#q#{$Q$[$k$l$s$x%Up![Z]!T!m#S#U#X#q#{$Q$[$k$l$s$x%UQ!f^R#l!gT#^!Z#_Q|VR!yqQ!x|R#y!yQ!PWR!{rQ!RXR!|sQxUQ!wpQ#i!cQ#o!jQ#p!kQ$}$gR%Z$|SgPwQ!phQ#s!nR$n#tZfPhw!n#ta!b[`a!V!^!`#d#eR#b!^R!g^R!i_R#n!iS$g#m$hR%X${V$e#m$h${Q!rjR#w!rQdOShPwU!ldh#tR#t!nQ$Q#SU$r$Q$x%UQ$x$[R%U$sQ#_!ZR$Y#_Q$t$QR%V$tQpUS!vp$pR$p#}Q$l#qR%R$lQ!ogS#u!o#vR#v!pQ#f!_R$`#fQ$h#mR%O$hQ$|$gR%Y$|_cOPdhw!n#t^UOPdhw!n#tQ!uoQ!}tQ#OuQ#PvQ#}#RR$a#hR$R#SQ!VZQ!d]Q#V!TQ#q!m[$P#S$Q$[$s$x%UQ$S#UQ$U#XS$j#q$lQ$o#{R%Q$kR$O#RQiPR#QwQ!c[Q!kaR#Y!VU!_[a!VQ!j`Q#c!^Q#g!`Q$^#dR$_#e",
  nodeNames: "⚠ Unit VariableName Comment StyleSheet RuleSet UniversalSelector TagSelector TagName NestingSelector ClassSelector . ClassName PseudoClassSelector : :: PseudoClassName PseudoClassName ) ( ArgList ValueName ParenthesizedValue ColorLiteral NumberLiteral StringLiteral BinaryExpression BinOp CallExpression Callee CallLiteral CallTag ParenthesizedContent ] [ LineNames LineName , PseudoClassName ArgList IdSelector # IdName AttributeSelector AttributeName MatchOp ChildSelector ChildOp DescendantSelector SiblingSelector SiblingOp } { Block Declaration PropertyName Important ; ImportStatement AtKeyword import KeywordQuery FeatureQuery FeatureName BinaryQuery LogicOp UnaryQuery UnaryQueryOp ParenthesizedQuery SelectorQuery selector MediaStatement media CharsetStatement charset NamespaceStatement namespace NamespaceName KeyframesStatement keyframes KeyframeName KeyframeList KeyframeSelector KeyframeRangeName SupportsStatement supports AtRule Styles",
  maxTerm: 117,
  nodeProps: [
    ["isolate", -2,3,25,""],
    ["openedBy", 18,"(",33,"[",51,"{"],
    ["closedBy", 19,")",34,"]",52,"}"]
  ],
  propSources: [cssHighlighting],
  skippedNodes: [0,3,88],
  repeatNodeCount: 11,
  tokenData: "J^~R!^OX$}X^%u^p$}pq%uqr)Xrs.Rst/utu6duv$}vw7^wx7oxy9^yz9oz{9t{|:_|}?Q}!O?c!O!P@Q!P!Q@i!Q![Ab![!]B]!]!^CX!^!_$}!_!`Cj!`!aC{!a!b$}!b!cDw!c!}$}!}#OFa#O#P$}#P#QFr#Q#R6d#R#T$}#T#UGT#U#c$}#c#dHf#d#o$}#o#pH{#p#q6d#q#rI^#r#sIo#s#y$}#y#z%u#z$f$}$f$g%u$g#BY$}#BY#BZ%u#BZ$IS$}$IS$I_%u$I_$I|$}$I|$JO%u$JO$JT$}$JT$JU%u$JU$KV$}$KV$KW%u$KW&FU$}&FU&FV%u&FV;'S$};'S;=`JW<%lO$}`%QSOy%^z;'S%^;'S;=`%o<%lO%^`%cSp`Oy%^z;'S%^;'S;=`%o<%lO%^`%rP;=`<%l%^~%zh#[~OX%^X^'f^p%^pq'fqy%^z#y%^#y#z'f#z$f%^$f$g'f$g#BY%^#BY#BZ'f#BZ$IS%^$IS$I_'f$I_$I|%^$I|$JO'f$JO$JT%^$JT$JU'f$JU$KV%^$KV$KW'f$KW&FU%^&FU&FV'f&FV;'S%^;'S;=`%o<%lO%^~'mh#[~p`OX%^X^'f^p%^pq'fqy%^z#y%^#y#z'f#z$f%^$f$g'f$g#BY%^#BY#BZ'f#BZ$IS%^$IS$I_'f$I_$I|%^$I|$JO'f$JO$JT%^$JT$JU'f$JU$KV%^$KV$KW'f$KW&FU%^&FU&FV'f&FV;'S%^;'S;=`%o<%lO%^l)[UOy%^z#]%^#]#^)n#^;'S%^;'S;=`%o<%lO%^l)sUp`Oy%^z#a%^#a#b*V#b;'S%^;'S;=`%o<%lO%^l*[Up`Oy%^z#d%^#d#e*n#e;'S%^;'S;=`%o<%lO%^l*sUp`Oy%^z#c%^#c#d+V#d;'S%^;'S;=`%o<%lO%^l+[Up`Oy%^z#f%^#f#g+n#g;'S%^;'S;=`%o<%lO%^l+sUp`Oy%^z#h%^#h#i,V#i;'S%^;'S;=`%o<%lO%^l,[Up`Oy%^z#T%^#T#U,n#U;'S%^;'S;=`%o<%lO%^l,sUp`Oy%^z#b%^#b#c-V#c;'S%^;'S;=`%o<%lO%^l-[Up`Oy%^z#h%^#h#i-n#i;'S%^;'S;=`%o<%lO%^l-uS!Y[p`Oy%^z;'S%^;'S;=`%o<%lO%^~.UWOY.RZr.Rrs.ns#O.R#O#P.s#P;'S.R;'S;=`/o<%lO.R~.sOi~~.vRO;'S.R;'S;=`/P;=`O.R~/SXOY.RZr.Rrs.ns#O.R#O#P.s#P;'S.R;'S;=`/o;=`<%l.R<%lO.R~/rP;=`<%l.Rn/zYyQOy%^z!Q%^!Q![0j![!c%^!c!i0j!i#T%^#T#Z0j#Z;'S%^;'S;=`%o<%lO%^l0oYp`Oy%^z!Q%^!Q![1_![!c%^!c!i1_!i#T%^#T#Z1_#Z;'S%^;'S;=`%o<%lO%^l1dYp`Oy%^z!Q%^!Q![2S![!c%^!c!i2S!i#T%^#T#Z2S#Z;'S%^;'S;=`%o<%lO%^l2ZYg[p`Oy%^z!Q%^!Q![2y![!c%^!c!i2y!i#T%^#T#Z2y#Z;'S%^;'S;=`%o<%lO%^l3QYg[p`Oy%^z!Q%^!Q![3p![!c%^!c!i3p!i#T%^#T#Z3p#Z;'S%^;'S;=`%o<%lO%^l3uYp`Oy%^z!Q%^!Q![4e![!c%^!c!i4e!i#T%^#T#Z4e#Z;'S%^;'S;=`%o<%lO%^l4lYg[p`Oy%^z!Q%^!Q![5[![!c%^!c!i5[!i#T%^#T#Z5[#Z;'S%^;'S;=`%o<%lO%^l5aYp`Oy%^z!Q%^!Q![6P![!c%^!c!i6P!i#T%^#T#Z6P#Z;'S%^;'S;=`%o<%lO%^l6WSg[p`Oy%^z;'S%^;'S;=`%o<%lO%^d6gUOy%^z!_%^!_!`6y!`;'S%^;'S;=`%o<%lO%^d7QS}Sp`Oy%^z;'S%^;'S;=`%o<%lO%^b7cSXQOy%^z;'S%^;'S;=`%o<%lO%^~7rWOY7oZw7owx.nx#O7o#O#P8[#P;'S7o;'S;=`9W<%lO7o~8_RO;'S7o;'S;=`8h;=`O7o~8kXOY7oZw7owx.nx#O7o#O#P8[#P;'S7o;'S;=`9W;=`<%l7o<%lO7o~9ZP;=`<%l7on9cSc^Oy%^z;'S%^;'S;=`%o<%lO%^~9tOb~n9{UUQkWOy%^z!_%^!_!`6y!`;'S%^;'S;=`%o<%lO%^n:fWkW!SQOy%^z!O%^!O!P;O!P!Q%^!Q![>T![;'S%^;'S;=`%o<%lO%^l;TUp`Oy%^z!Q%^!Q![;g![;'S%^;'S;=`%o<%lO%^l;nYp`#e[Oy%^z!Q%^!Q![;g![!g%^!g!h<^!h#X%^#X#Y<^#Y;'S%^;'S;=`%o<%lO%^l<cYp`Oy%^z{%^{|=R|}%^}!O=R!O!Q%^!Q![=j![;'S%^;'S;=`%o<%lO%^l=WUp`Oy%^z!Q%^!Q![=j![;'S%^;'S;=`%o<%lO%^l=qUp`#e[Oy%^z!Q%^!Q![=j![;'S%^;'S;=`%o<%lO%^l>[[p`#e[Oy%^z!O%^!O!P;g!P!Q%^!Q![>T![!g%^!g!h<^!h#X%^#X#Y<^#Y;'S%^;'S;=`%o<%lO%^n?VSu^Oy%^z;'S%^;'S;=`%o<%lO%^l?hWkWOy%^z!O%^!O!P;O!P!Q%^!Q![>T![;'S%^;'S;=`%o<%lO%^n@VUZQOy%^z!Q%^!Q![;g![;'S%^;'S;=`%o<%lO%^~@nTkWOy%^z{@}{;'S%^;'S;=`%o<%lO%^~AUSp`#]~Oy%^z;'S%^;'S;=`%o<%lO%^lAg[#e[Oy%^z!O%^!O!P;g!P!Q%^!Q![>T![!g%^!g!h<^!h#X%^#X#Y<^#Y;'S%^;'S;=`%o<%lO%^bBbU^QOy%^z![%^![!]Bt!];'S%^;'S;=`%o<%lO%^bB{S_Qp`Oy%^z;'S%^;'S;=`%o<%lO%^nC^S!Z^Oy%^z;'S%^;'S;=`%o<%lO%^dCoS}SOy%^z;'S%^;'S;=`%o<%lO%^bDQU!PQOy%^z!`%^!`!aDd!a;'S%^;'S;=`%o<%lO%^bDkS!PQp`Oy%^z;'S%^;'S;=`%o<%lO%^bDzWOy%^z!c%^!c!}Ed!}#T%^#T#oEd#o;'S%^;'S;=`%o<%lO%^bEk[!]Qp`Oy%^z}%^}!OEd!O!Q%^!Q![Ed![!c%^!c!}Ed!}#T%^#T#oEd#o;'S%^;'S;=`%o<%lO%^nFfSr^Oy%^z;'S%^;'S;=`%o<%lO%^nFwSq^Oy%^z;'S%^;'S;=`%o<%lO%^bGWUOy%^z#b%^#b#cGj#c;'S%^;'S;=`%o<%lO%^bGoUp`Oy%^z#W%^#W#XHR#X;'S%^;'S;=`%o<%lO%^bHYS!cQp`Oy%^z;'S%^;'S;=`%o<%lO%^bHiUOy%^z#f%^#f#gHR#g;'S%^;'S;=`%o<%lO%^fIQS!UUOy%^z;'S%^;'S;=`%o<%lO%^nIcS!T^Oy%^z;'S%^;'S;=`%o<%lO%^fItU!SQOy%^z!_%^!_!`6y!`;'S%^;'S;=`%o<%lO%^`JZP;=`<%l$}",
  tokenizers: [descendant, unitToken, identifiers, 1, 2, 3, 4, new LocalTokenGroup("m~RRYZ[z{a~~g~aO#_~~dP!P!Qg~lO#`~~", 28, 106)],
  topRules: {"StyleSheet":[0,4],"Styles":[1,87]},
  specialized: [{term: 101, get: (value) => spec_callee[value] || -1},{term: 59, get: (value) => spec_AtKeyword[value] || -1},{term: 102, get: (value) => spec_identifier[value] || -1}],
  tokenPrec: 1219
});

let _properties = null;
function properties() {
    if (!_properties && typeof document == "object" && document.body) {
        let { style } = document.body, names = [], seen = new Set;
        for (let prop in style)
            if (prop != "cssText" && prop != "cssFloat") {
                if (typeof style[prop] == "string") {
                    if (/[A-Z]/.test(prop))
                        prop = prop.replace(/[A-Z]/g, ch => "-" + ch.toLowerCase());
                    if (!seen.has(prop)) {
                        names.push(prop);
                        seen.add(prop);
                    }
                }
            }
        _properties = names.sort().map(name => ({ type: "property", label: name, apply: name + ": " }));
    }
    return _properties || [];
}
const pseudoClasses = /*@__PURE__*/[
    "active", "after", "any-link", "autofill", "backdrop", "before",
    "checked", "cue", "default", "defined", "disabled", "empty",
    "enabled", "file-selector-button", "first", "first-child",
    "first-letter", "first-line", "first-of-type", "focus",
    "focus-visible", "focus-within", "fullscreen", "has", "host",
    "host-context", "hover", "in-range", "indeterminate", "invalid",
    "is", "lang", "last-child", "last-of-type", "left", "link", "marker",
    "modal", "not", "nth-child", "nth-last-child", "nth-last-of-type",
    "nth-of-type", "only-child", "only-of-type", "optional", "out-of-range",
    "part", "placeholder", "placeholder-shown", "read-only", "read-write",
    "required", "right", "root", "scope", "selection", "slotted", "target",
    "target-text", "valid", "visited", "where"
].map(name => ({ type: "class", label: name }));
const values = /*@__PURE__*/[
    "above", "absolute", "activeborder", "additive", "activecaption", "after-white-space",
    "ahead", "alias", "all", "all-scroll", "alphabetic", "alternate", "always",
    "antialiased", "appworkspace", "asterisks", "attr", "auto", "auto-flow", "avoid", "avoid-column",
    "avoid-page", "avoid-region", "axis-pan", "background", "backwards", "baseline", "below",
    "bidi-override", "blink", "block", "block-axis", "bold", "bolder", "border", "border-box",
    "both", "bottom", "break", "break-all", "break-word", "bullets", "button", "button-bevel",
    "buttonface", "buttonhighlight", "buttonshadow", "buttontext", "calc", "capitalize",
    "caps-lock-indicator", "caption", "captiontext", "caret", "cell", "center", "checkbox", "circle",
    "cjk-decimal", "clear", "clip", "close-quote", "col-resize", "collapse", "color", "color-burn",
    "color-dodge", "column", "column-reverse", "compact", "condensed", "contain", "content",
    "contents", "content-box", "context-menu", "continuous", "copy", "counter", "counters", "cover",
    "crop", "cross", "crosshair", "currentcolor", "cursive", "cyclic", "darken", "dashed", "decimal",
    "decimal-leading-zero", "default", "default-button", "dense", "destination-atop", "destination-in",
    "destination-out", "destination-over", "difference", "disc", "discard", "disclosure-closed",
    "disclosure-open", "document", "dot-dash", "dot-dot-dash", "dotted", "double", "down", "e-resize",
    "ease", "ease-in", "ease-in-out", "ease-out", "element", "ellipse", "ellipsis", "embed", "end",
    "ethiopic-abegede-gez", "ethiopic-halehame-aa-er", "ethiopic-halehame-gez", "ew-resize", "exclusion",
    "expanded", "extends", "extra-condensed", "extra-expanded", "fantasy", "fast", "fill", "fill-box",
    "fixed", "flat", "flex", "flex-end", "flex-start", "footnotes", "forwards", "from",
    "geometricPrecision", "graytext", "grid", "groove", "hand", "hard-light", "help", "hidden", "hide",
    "higher", "highlight", "highlighttext", "horizontal", "hsl", "hsla", "hue", "icon", "ignore",
    "inactiveborder", "inactivecaption", "inactivecaptiontext", "infinite", "infobackground", "infotext",
    "inherit", "initial", "inline", "inline-axis", "inline-block", "inline-flex", "inline-grid",
    "inline-table", "inset", "inside", "intrinsic", "invert", "italic", "justify", "keep-all",
    "landscape", "large", "larger", "left", "level", "lighter", "lighten", "line-through", "linear",
    "linear-gradient", "lines", "list-item", "listbox", "listitem", "local", "logical", "loud", "lower",
    "lower-hexadecimal", "lower-latin", "lower-norwegian", "lowercase", "ltr", "luminosity", "manipulation",
    "match", "matrix", "matrix3d", "medium", "menu", "menutext", "message-box", "middle", "min-intrinsic",
    "mix", "monospace", "move", "multiple", "multiple_mask_images", "multiply", "n-resize", "narrower",
    "ne-resize", "nesw-resize", "no-close-quote", "no-drop", "no-open-quote", "no-repeat", "none",
    "normal", "not-allowed", "nowrap", "ns-resize", "numbers", "numeric", "nw-resize", "nwse-resize",
    "oblique", "opacity", "open-quote", "optimizeLegibility", "optimizeSpeed", "outset", "outside",
    "outside-shape", "overlay", "overline", "padding", "padding-box", "painted", "page", "paused",
    "perspective", "pinch-zoom", "plus-darker", "plus-lighter", "pointer", "polygon", "portrait",
    "pre", "pre-line", "pre-wrap", "preserve-3d", "progress", "push-button", "radial-gradient", "radio",
    "read-only", "read-write", "read-write-plaintext-only", "rectangle", "region", "relative", "repeat",
    "repeating-linear-gradient", "repeating-radial-gradient", "repeat-x", "repeat-y", "reset", "reverse",
    "rgb", "rgba", "ridge", "right", "rotate", "rotate3d", "rotateX", "rotateY", "rotateZ", "round",
    "row", "row-resize", "row-reverse", "rtl", "run-in", "running", "s-resize", "sans-serif", "saturation",
    "scale", "scale3d", "scaleX", "scaleY", "scaleZ", "screen", "scroll", "scrollbar", "scroll-position",
    "se-resize", "self-start", "self-end", "semi-condensed", "semi-expanded", "separate", "serif", "show",
    "single", "skew", "skewX", "skewY", "skip-white-space", "slide", "slider-horizontal",
    "slider-vertical", "sliderthumb-horizontal", "sliderthumb-vertical", "slow", "small", "small-caps",
    "small-caption", "smaller", "soft-light", "solid", "source-atop", "source-in", "source-out",
    "source-over", "space", "space-around", "space-between", "space-evenly", "spell-out", "square", "start",
    "static", "status-bar", "stretch", "stroke", "stroke-box", "sub", "subpixel-antialiased", "svg_masks",
    "super", "sw-resize", "symbolic", "symbols", "system-ui", "table", "table-caption", "table-cell",
    "table-column", "table-column-group", "table-footer-group", "table-header-group", "table-row",
    "table-row-group", "text", "text-bottom", "text-top", "textarea", "textfield", "thick", "thin",
    "threeddarkshadow", "threedface", "threedhighlight", "threedlightshadow", "threedshadow", "to", "top",
    "transform", "translate", "translate3d", "translateX", "translateY", "translateZ", "transparent",
    "ultra-condensed", "ultra-expanded", "underline", "unidirectional-pan", "unset", "up", "upper-latin",
    "uppercase", "url", "var", "vertical", "vertical-text", "view-box", "visible", "visibleFill",
    "visiblePainted", "visibleStroke", "visual", "w-resize", "wait", "wave", "wider", "window", "windowframe",
    "windowtext", "words", "wrap", "wrap-reverse", "x-large", "x-small", "xor", "xx-large", "xx-small"
].map(name => ({ type: "keyword", label: name })).concat(/*@__PURE__*/[
    "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige",
    "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
    "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue",
    "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod",
    "darkgray", "darkgreen", "darkkhaki", "darkmagenta", "darkolivegreen",
    "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
    "darkslateblue", "darkslategray", "darkturquoise", "darkviolet",
    "deeppink", "deepskyblue", "dimgray", "dodgerblue", "firebrick",
    "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite",
    "gold", "goldenrod", "gray", "grey", "green", "greenyellow", "honeydew",
    "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
    "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
    "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightpink",
    "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray",
    "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta",
    "maroon", "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple",
    "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise",
    "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
    "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered",
    "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
    "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue",
    "purple", "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown",
    "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver", "skyblue",
    "slateblue", "slategray", "snow", "springgreen", "steelblue", "tan",
    "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white",
    "whitesmoke", "yellow", "yellowgreen"
].map(name => ({ type: "constant", label: name })));
const tags = /*@__PURE__*/[
    "a", "abbr", "address", "article", "aside", "b", "bdi", "bdo", "blockquote", "body",
    "br", "button", "canvas", "caption", "cite", "code", "col", "colgroup", "dd", "del",
    "details", "dfn", "dialog", "div", "dl", "dt", "em", "figcaption", "figure", "footer",
    "form", "header", "hgroup", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "html", "i", "iframe",
    "img", "input", "ins", "kbd", "label", "legend", "li", "main", "meter", "nav", "ol", "output",
    "p", "pre", "ruby", "section", "select", "small", "source", "span", "strong", "sub", "summary",
    "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "tr", "u", "ul"
].map(name => ({ type: "type", label: name }));
const atRules = /*@__PURE__*/[
    "@charset", "@color-profile", "@container", "@counter-style", "@font-face", "@font-feature-values",
    "@font-palette-values", "@import", "@keyframes", "@layer", "@media", "@namespace", "@page",
    "@position-try", "@property", "@scope", "@starting-style", "@supports", "@view-transition"
].map(label => ({ type: "keyword", label }));
const identifier$1 = /^(\w[\w-]*|-\w[\w-]*|)$/, variable = /^-(-[\w-]*)?$/;
function isVarArg(node, doc) {
    var _a;
    if (node.name == "(" || node.type.isError)
        node = node.parent || node;
    if (node.name != "ArgList")
        return false;
    let callee = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.firstChild;
    if ((callee === null || callee === void 0 ? void 0 : callee.name) != "Callee")
        return false;
    return doc.sliceString(callee.from, callee.to) == "var";
}
const VariablesByNode = /*@__PURE__*/new NodeWeakMap();
const declSelector = ["Declaration"];
function astTop(node) {
    for (let cur = node;;) {
        if (cur.type.isTop)
            return cur;
        if (!(cur = cur.parent))
            return node;
    }
}
function variableNames(doc, node, isVariable) {
    if (node.to - node.from > 4096) {
        let known = VariablesByNode.get(node);
        if (known)
            return known;
        let result = [], seen = new Set, cursor = node.cursor(exports.IterMode.IncludeAnonymous);
        if (cursor.firstChild())
            do {
                for (let option of variableNames(doc, cursor.node, isVariable))
                    if (!seen.has(option.label)) {
                        seen.add(option.label);
                        result.push(option);
                    }
            } while (cursor.nextSibling());
        VariablesByNode.set(node, result);
        return result;
    }
    else {
        let result = [], seen = new Set;
        node.cursor().iterate(node => {
            var _a;
            if (isVariable(node) && node.matchContext(declSelector) && ((_a = node.node.nextSibling) === null || _a === void 0 ? void 0 : _a.name) == ":") {
                let name = doc.sliceString(node.from, node.to);
                if (!seen.has(name)) {
                    seen.add(name);
                    result.push({ label: name, type: "variable" });
                }
            }
        });
        return result;
    }
}
/**
Create a completion source for a CSS dialect, providing a
predicate for determining what kind of syntax node can act as a
completable variable. This is used by language modes like Sass and
Less to reuse this package's completion logic.
*/
const defineCSSCompletionSource = (isVariable) => context => {
    let { state, pos } = context, node = ext_CodeMirror_v6_lib.syntaxTree(state).resolveInner(pos, -1);
    let isDash = node.type.isError && node.from == node.to - 1 && state.doc.sliceString(node.from, node.to) == "-";
    if (node.name == "PropertyName" ||
        (isDash || node.name == "TagName") && /^(Block|Styles)$/.test(node.resolve(node.to).name))
        return { from: node.from, options: properties(), validFor: identifier$1 };
    if (node.name == "ValueName")
        return { from: node.from, options: values, validFor: identifier$1 };
    if (node.name == "PseudoClassName")
        return { from: node.from, options: pseudoClasses, validFor: identifier$1 };
    if (isVariable(node) || (context.explicit || isDash) && isVarArg(node, state.doc))
        return { from: isVariable(node) || isDash ? node.from : pos,
            options: variableNames(state.doc, astTop(node), isVariable),
            validFor: variable };
    if (node.name == "TagName") {
        for (let { parent } = node; parent; parent = parent.parent)
            if (parent.name == "Block")
                return { from: node.from, options: properties(), validFor: identifier$1 };
        return { from: node.from, options: tags, validFor: identifier$1 };
    }
    if (node.name == "AtKeyword")
        return { from: node.from, options: atRules, validFor: identifier$1 };
    if (!context.explicit)
        return null;
    let above = node.resolve(pos), before = above.childBefore(pos);
    if (before && before.name == ":" && above.name == "PseudoClassSelector")
        return { from: pos, options: pseudoClasses, validFor: identifier$1 };
    if (before && before.name == ":" && above.name == "Declaration" || above.name == "ArgList")
        return { from: pos, options: values, validFor: identifier$1 };
    if (above.name == "Block" || above.name == "Styles")
        return { from: pos, options: properties(), validFor: identifier$1 };
    return null;
};
/**
CSS property, variable, and value keyword completion source.
*/
const cssCompletionSource = /*@__PURE__*/defineCSSCompletionSource(n => n.name == "VariableName");

/**
A language provider based on the [Lezer CSS
parser](https://github.com/lezer-parser/css), extended with
highlighting and indentation information.
*/
const cssLanguage = /*@__PURE__*/ext_CodeMirror_v6_lib.LRLanguage.define({
    name: "css",
    parser: /*@__PURE__*/parser$3.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_v6_lib.indentNodeProp.add({
                Declaration: /*@__PURE__*/ext_CodeMirror_v6_lib.continuedIndent()
            }),
            /*@__PURE__*/ext_CodeMirror_v6_lib.foldNodeProp.add({
                "Block KeyframeList": ext_CodeMirror_v6_lib.foldInside
            })
        ]
    }),
    languageData: {
        commentTokens: { block: { open: "/*", close: "*/" } },
        indentOnInput: /^\s*\}$/,
        wordChars: "-"
    }
});
/**
Language support for CSS.
*/
function css() {
    return new ext_CodeMirror_v6_lib.LanguageSupport(cssLanguage, cssLanguage.data.of({ autocomplete: cssCompletionSource }));
}

const jsonHighlighting = ext_CodeMirror_v6_lib.styleTags({
  String: ext_CodeMirror_v6_lib.tags.string,
  Number: ext_CodeMirror_v6_lib.tags.number,
  "True False": ext_CodeMirror_v6_lib.tags.bool,
  PropertyName: ext_CodeMirror_v6_lib.tags.propertyName,
  Null: ext_CodeMirror_v6_lib.tags.null,
  ", :": ext_CodeMirror_v6_lib.tags.separator,
  "[ ]": ext_CodeMirror_v6_lib.tags.squareBracket,
  "{ }": ext_CodeMirror_v6_lib.tags.brace
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const parser$2 = LRParser.deserialize({
  version: 14,
  states: "$bOVQPOOOOQO'#Cb'#CbOnQPO'#CeOvQPO'#ClOOQO'#Cr'#CrQOQPOOOOQO'#Cg'#CgO}QPO'#CfO!SQPO'#CtOOQO,59P,59PO![QPO,59PO!aQPO'#CuOOQO,59W,59WO!iQPO,59WOVQPO,59QOqQPO'#CmO!nQPO,59`OOQO1G.k1G.kOVQPO'#CnO!vQPO,59aOOQO1G.r1G.rOOQO1G.l1G.lOOQO,59X,59XOOQO-E6k-E6kOOQO,59Y,59YOOQO-E6l-E6l",
  stateData: "#O~OeOS~OQSORSOSSOTSOWQO_ROgPO~OVXOgUO~O^[O~PVO[^O~O]_OVhX~OVaO~O]bO^iX~O^dO~O]_OVha~O]bO^ia~O",
  goto: "!kjPPPPPPkPPkqwPPPPk{!RPPP!XP!e!hXSOR^bQWQRf_TVQ_Q`WRg`QcZRicQTOQZRQe^RhbRYQR]R",
  nodeNames: "⚠ JsonText True False Null Number String } { Object Property PropertyName : , ] [ Array",
  maxTerm: 25,
  nodeProps: [
    ["isolate", -2,6,11,""],
    ["openedBy", 7,"{",14,"["],
    ["closedBy", 8,"}",15,"]"]
  ],
  propSources: [jsonHighlighting],
  skippedNodes: [0],
  repeatNodeCount: 2,
  tokenData: "(|~RaXY!WYZ!W]^!Wpq!Wrs!]|}$u}!O$z!Q!R%T!R![&c![!]&t!}#O&y#P#Q'O#Y#Z'T#b#c'r#h#i(Z#o#p(r#q#r(w~!]Oe~~!`Wpq!]qr!]rs!xs#O!]#O#P!}#P;'S!];'S;=`$o<%lO!]~!}Og~~#QXrs!]!P!Q!]#O#P!]#U#V!]#Y#Z!]#b#c!]#f#g!]#h#i!]#i#j#m~#pR!Q![#y!c!i#y#T#Z#y~#|R!Q![$V!c!i$V#T#Z$V~$YR!Q![$c!c!i$c#T#Z$c~$fR!Q![!]!c!i!]#T#Z!]~$rP;=`<%l!]~$zO]~~$}Q!Q!R%T!R![&c~%YRT~!O!P%c!g!h%w#X#Y%w~%fP!Q![%i~%nRT~!Q![%i!g!h%w#X#Y%w~%zR{|&T}!O&T!Q![&Z~&WP!Q![&Z~&`PT~!Q![&Z~&hST~!O!P%c!Q![&c!g!h%w#X#Y%w~&yO[~~'OO_~~'TO^~~'WP#T#U'Z~'^P#`#a'a~'dP#g#h'g~'jP#X#Y'm~'rOR~~'uP#i#j'x~'{P#`#a(O~(RP#`#a(U~(ZOS~~(^P#f#g(a~(dP#i#j(g~(jP#X#Y(m~(rOQ~~(wOW~~(|OV~",
  tokenizers: [0],
  topRules: {"JsonText":[0,1]},
  tokenPrec: 0
});

/**
Calls
[`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)
on the document and, if that throws an error, reports it as a
single diagnostic.
*/
const jsonParseLinter = () => (view) => {
    try {
        JSON.parse(view.state.doc.toString());
    }
    catch (e) {
        if (!(e instanceof SyntaxError))
            throw e;
        const pos = getErrorPosition(e, view.state.doc);
        return [{
                from: pos,
                message: e.message,
                severity: 'error',
                to: pos
            }];
    }
    return [];
};
function getErrorPosition(error, doc) {
    let m;
    if (m = error.message.match(/at position (\d+)/))
        return Math.min(+m[1], doc.length);
    if (m = error.message.match(/at line (\d+) column (\d+)/))
        return Math.min(doc.line(+m[1]).from + (+m[2]) - 1, doc.length);
    return 0;
}

/**
A language provider that provides JSON parsing.
*/
const jsonLanguage = /*@__PURE__*/ext_CodeMirror_v6_lib.LRLanguage.define({
    name: "json",
    parser: /*@__PURE__*/parser$2.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_v6_lib.indentNodeProp.add({
                Object: /*@__PURE__*/ext_CodeMirror_v6_lib.continuedIndent({ except: /^\s*\}/ }),
                Array: /*@__PURE__*/ext_CodeMirror_v6_lib.continuedIndent({ except: /^\s*\]/ })
            }),
            /*@__PURE__*/ext_CodeMirror_v6_lib.foldNodeProp.add({
                "Object Array": ext_CodeMirror_v6_lib.foldInside
            })
        ]
    }),
    languageData: {
        closeBrackets: { brackets: ["[", "{", '"'] },
        indentOnInput: /^\s*[\}\]]$/
    }
});
/**
JSON language support.
*/
function json() {
    return new ext_CodeMirror_v6_lib.LanguageSupport(jsonLanguage);
}

// This file was generated by lezer-generator. You probably shouldn't edit it.
const scriptText = 54,
  StartCloseScriptTag = 1,
  styleText = 55,
  StartCloseStyleTag = 2,
  textareaText = 56,
  StartCloseTextareaTag = 3,
  EndTag = 4,
  SelfClosingEndTag = 5,
  StartTag = 6,
  StartScriptTag = 7,
  StartStyleTag = 8,
  StartTextareaTag = 9,
  StartSelfClosingTag = 10,
  StartCloseTag = 11,
  NoMatchStartCloseTag = 12,
  MismatchedStartCloseTag = 13,
  missingCloseTag = 57,
  IncompleteCloseTag = 14,
  commentContent$1 = 58,
  Element = 20,
  TagName = 22,
  Attribute = 23,
  AttributeName = 24,
  AttributeValue = 26,
  UnquotedAttributeValue = 27,
  ScriptText = 28,
  StyleText = 31,
  TextareaText = 34,
  OpenTag = 36,
  CloseTag = 37,
  Dialect_noMatch = 0,
  Dialect_selfClosing = 1;

/* Hand-written tokenizers for HTML. */

const selfClosers$1 = {
  area: true, base: true, br: true, col: true, command: true,
  embed: true, frame: true, hr: true, img: true, input: true,
  keygen: true, link: true, meta: true, param: true, source: true,
  track: true, wbr: true, menuitem: true
};

const implicitlyClosed = {
  dd: true, li: true, optgroup: true, option: true, p: true,
  rp: true, rt: true, tbody: true, td: true, tfoot: true,
  th: true, tr: true
};

const closeOnOpen = {
  dd: {dd: true, dt: true},
  dt: {dd: true, dt: true},
  li: {li: true},
  option: {option: true, optgroup: true},
  optgroup: {optgroup: true},
  p: {
    address: true, article: true, aside: true, blockquote: true, dir: true,
    div: true, dl: true, fieldset: true, footer: true, form: true,
    h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
    header: true, hgroup: true, hr: true, menu: true, nav: true, ol: true,
    p: true, pre: true, section: true, table: true, ul: true
  },
  rp: {rp: true, rt: true},
  rt: {rp: true, rt: true},
  tbody: {tbody: true, tfoot: true},
  td: {td: true, th: true},
  tfoot: {tbody: true},
  th: {td: true, th: true},
  thead: {tbody: true, tfoot: true},
  tr: {tr: true}
};

function nameChar(ch) {
  return ch == 45 || ch == 46 || ch == 58 || ch >= 65 && ch <= 90 || ch == 95 || ch >= 97 && ch <= 122 || ch >= 161
}

function isSpace(ch) {
  return ch == 9 || ch == 10 || ch == 13 || ch == 32
}

let cachedName = null, cachedInput = null, cachedPos = 0;
function tagNameAfter(input, offset) {
  let pos = input.pos + offset;
  if (cachedPos == pos && cachedInput == input) return cachedName
  let next = input.peek(offset);
  while (isSpace(next)) next = input.peek(++offset);
  let name = "";
  for (;;) {
    if (!nameChar(next)) break
    name += String.fromCharCode(next);
    next = input.peek(++offset);
  }
  // Undefined to signal there's a <? or <!, null for just missing
  cachedInput = input; cachedPos = pos;
  return cachedName = name ? name.toLowerCase() : next == question || next == bang ? undefined : null
}

const lessThan = 60, greaterThan = 62, slash = 47, question = 63, bang = 33, dash = 45;

function ElementContext(name, parent) {
  this.name = name;
  this.parent = parent;
}

const startTagTerms = [StartTag, StartSelfClosingTag, StartScriptTag, StartStyleTag, StartTextareaTag];

const elementContext = new ContextTracker({
  start: null,
  shift(context, term, stack, input) {
    return startTagTerms.indexOf(term) > -1 ? new ElementContext(tagNameAfter(input, 1) || "", context) : context
  },
  reduce(context, term) {
    return term == Element && context ? context.parent : context
  },
  reuse(context, node, stack, input) {
    let type = node.type.id;
    return type == StartTag || type == OpenTag
      ? new ElementContext(tagNameAfter(input, 1) || "", context) : context
  },
  strict: false
});

const tagStart = new ExternalTokenizer((input, stack) => {
  if (input.next != lessThan) {
    // End of file, close any open tags
    if (input.next < 0 && stack.context) input.acceptToken(missingCloseTag);
    return
  }
  input.advance();
  let close = input.next == slash;
  if (close) input.advance();
  let name = tagNameAfter(input, 0);
  if (name === undefined) return
  if (!name) return input.acceptToken(close ? IncompleteCloseTag : StartTag)

  let parent = stack.context ? stack.context.name : null;
  if (close) {
    if (name == parent) return input.acceptToken(StartCloseTag)
    if (parent && implicitlyClosed[parent]) return input.acceptToken(missingCloseTag, -2)
    if (stack.dialectEnabled(Dialect_noMatch)) return input.acceptToken(NoMatchStartCloseTag)
    for (let cx = stack.context; cx; cx = cx.parent) if (cx.name == name) return
    input.acceptToken(MismatchedStartCloseTag);
  } else {
    if (name == "script") return input.acceptToken(StartScriptTag)
    if (name == "style") return input.acceptToken(StartStyleTag)
    if (name == "textarea") return input.acceptToken(StartTextareaTag)
    if (selfClosers$1.hasOwnProperty(name)) return input.acceptToken(StartSelfClosingTag)
    if (parent && closeOnOpen[parent] && closeOnOpen[parent][name]) input.acceptToken(missingCloseTag, -1);
    else input.acceptToken(StartTag);
  }
}, {contextual: true});

const commentContent = new ExternalTokenizer(input => {
  for (let dashes = 0, i = 0;; i++) {
    if (input.next < 0) {
      if (i) input.acceptToken(commentContent$1);
      break
    }
    if (input.next == dash) {
      dashes++;
    } else if (input.next == greaterThan && dashes >= 2) {
      if (i >= 3) input.acceptToken(commentContent$1, -2);
      break
    } else {
      dashes = 0;
    }
    input.advance();
  }
});

function inForeignElement(context) {
  for (; context; context = context.parent)
    if (context.name == "svg" || context.name == "math") return true
  return false
}

const endTag = new ExternalTokenizer((input, stack) => {
  if (input.next == slash && input.peek(1) == greaterThan) {
    let selfClosing = stack.dialectEnabled(Dialect_selfClosing) || inForeignElement(stack.context);
    input.acceptToken(selfClosing ? SelfClosingEndTag : EndTag, 2);
  } else if (input.next == greaterThan) {
    input.acceptToken(EndTag, 1);
  }
});

function contentTokenizer(tag, textToken, endToken) {
  let lastState = 2 + tag.length;
  return new ExternalTokenizer(input => {
    // state means:
    // - 0 nothing matched
    // - 1 '<' matched
    // - 2 '</' + possibly whitespace matched
    // - 3-(1+tag.length) part of the tag matched
    // - lastState whole tag + possibly whitespace matched
    for (let state = 0, matchedLen = 0, i = 0;; i++) {
      if (input.next < 0) {
        if (i) input.acceptToken(textToken);
        break
      }
      if (state == 0 && input.next == lessThan ||
          state == 1 && input.next == slash ||
          state >= 2 && state < lastState && input.next == tag.charCodeAt(state - 2)) {
        state++;
        matchedLen++;
      } else if ((state == 2 || state == lastState) && isSpace(input.next)) {
        matchedLen++;
      } else if (state == lastState && input.next == greaterThan) {
        if (i > matchedLen)
          input.acceptToken(textToken, -matchedLen);
        else
          input.acceptToken(endToken, -(matchedLen - 2));
        break
      } else if ((input.next == 10 /* '\n' */ || input.next == 13 /* '\r' */) && i) {
        input.acceptToken(textToken, 1);
        break
      } else {
        state = matchedLen = 0;
      }
      input.advance();
    }
  })
}

const scriptTokens = contentTokenizer("script", scriptText, StartCloseScriptTag);

const styleTokens = contentTokenizer("style", styleText, StartCloseStyleTag);

const textareaTokens = contentTokenizer("textarea", textareaText, StartCloseTextareaTag);

const htmlHighlighting = ext_CodeMirror_v6_lib.styleTags({
  "Text RawText": ext_CodeMirror_v6_lib.tags.content,
  "StartTag StartCloseTag SelfClosingEndTag EndTag": ext_CodeMirror_v6_lib.tags.angleBracket,
  TagName: ext_CodeMirror_v6_lib.tags.tagName,
  "MismatchedCloseTag/TagName": [ext_CodeMirror_v6_lib.tags.tagName,  ext_CodeMirror_v6_lib.tags.invalid],
  AttributeName: ext_CodeMirror_v6_lib.tags.attributeName,
  "AttributeValue UnquotedAttributeValue": ext_CodeMirror_v6_lib.tags.attributeValue,
  Is: ext_CodeMirror_v6_lib.tags.definitionOperator,
  "EntityReference CharacterReference": ext_CodeMirror_v6_lib.tags.character,
  Comment: ext_CodeMirror_v6_lib.tags.blockComment,
  ProcessingInst: ext_CodeMirror_v6_lib.tags.processingInstruction,
  DoctypeDecl: ext_CodeMirror_v6_lib.tags.documentMeta
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const parser$1 = LRParser.deserialize({
  version: 14,
  states: ",xOVO!rOOO!WQ#tO'#CqO!]Q#tO'#CzO!bQ#tO'#C}O!gQ#tO'#DQO!lQ#tO'#DSO!qOaO'#CpO!|ObO'#CpO#XOdO'#CpO$eO!rO'#CpOOO`'#Cp'#CpO$lO$fO'#DTO$tQ#tO'#DVO$yQ#tO'#DWOOO`'#Dk'#DkOOO`'#DY'#DYQVO!rOOO%OQ&rO,59]O%ZQ&rO,59fO%fQ&rO,59iO%qQ&rO,59lO%|Q&rO,59nOOOa'#D^'#D^O&XOaO'#CxO&dOaO,59[OOOb'#D_'#D_O&lObO'#C{O&wObO,59[OOOd'#D`'#D`O'POdO'#DOO'[OdO,59[OOO`'#Da'#DaO'dO!rO,59[O'kQ#tO'#DROOO`,59[,59[OOOp'#Db'#DbO'pO$fO,59oOOO`,59o,59oO'xQ#|O,59qO'}Q#|O,59rOOO`-E7W-E7WO(SQ&rO'#CsOOQW'#DZ'#DZO(bQ&rO1G.wOOOa1G.w1G.wOOO`1G/Y1G/YO(mQ&rO1G/QOOOb1G/Q1G/QO(xQ&rO1G/TOOOd1G/T1G/TO)TQ&rO1G/WOOO`1G/W1G/WO)`Q&rO1G/YOOOa-E7[-E7[O)kQ#tO'#CyOOO`1G.v1G.vOOOb-E7]-E7]O)pQ#tO'#C|OOOd-E7^-E7^O)uQ#tO'#DPOOO`-E7_-E7_O)zQ#|O,59mOOOp-E7`-E7`OOO`1G/Z1G/ZOOO`1G/]1G/]OOO`1G/^1G/^O*PQ,UO,59_OOQW-E7X-E7XOOOa7+$c7+$cOOO`7+$t7+$tOOOb7+$l7+$lOOOd7+$o7+$oOOO`7+$r7+$rO*[Q#|O,59eO*aQ#|O,59hO*fQ#|O,59kOOO`1G/X1G/XO*kO7[O'#CvO*|OMhO'#CvOOQW1G.y1G.yOOO`1G/P1G/POOO`1G/S1G/SOOO`1G/V1G/VOOOO'#D['#D[O+_O7[O,59bOOQW,59b,59bOOOO'#D]'#D]O+pOMhO,59bOOOO-E7Y-E7YOOQW1G.|1G.|OOOO-E7Z-E7Z",
  stateData: ",]~O!^OS~OUSOVPOWQOXROYTO[]O][O^^O`^Oa^Ob^Oc^Ox^O{_O!dZO~OfaO~OfbO~OfcO~OfdO~OfeO~O!WfOPlP!ZlP~O!XiOQoP!ZoP~O!YlORrP!ZrP~OUSOVPOWQOXROYTOZqO[]O][O^^O`^Oa^Ob^Oc^Ox^O!dZO~O!ZrO~P#dO![sO!euO~OfvO~OfwO~OS|OT}OhyO~OS!POT}OhyO~OS!ROT}OhyO~OS!TOT}OhyO~OS}OT}OhyO~O!WfOPlX!ZlX~OP!WO!Z!XO~O!XiOQoX!ZoX~OQ!ZO!Z!XO~O!YlORrX!ZrX~OR!]O!Z!XO~O!Z!XO~P#dOf!_O~O![sO!e!aO~OS!bO~OS!cO~Oi!dOSgXTgXhgX~OS!fOT!gOhyO~OS!hOT!gOhyO~OS!iOT!gOhyO~OS!jOT!gOhyO~OS!gOT!gOhyO~Of!kO~Of!lO~Of!mO~OS!nO~Ok!qO!`!oO!b!pO~OS!rO~OS!sO~OS!tO~Oa!uOb!uOc!uO!`!wO!a!uO~Oa!xOb!xOc!xO!b!wO!c!xO~Oa!uOb!uOc!uO!`!{O!a!uO~Oa!xOb!xOc!xO!b!{O!c!xO~OT~bac!dx{!d~",
  goto: "%p!`PPPPPPPPPPPPPPPPPPPP!a!gP!mPP!yP!|#P#S#Y#]#`#f#i#l#r#x!aP!a!aP$O$U$l$r$x%O%U%[%bPPPPPPPP%hX^OX`pXUOX`pezabcde{!O!Q!S!UR!q!dRhUR!XhXVOX`pRkVR!XkXWOX`pRnWR!XnXXOX`pQrXR!XpXYOX`pQ`ORx`Q{aQ!ObQ!QcQ!SdQ!UeZ!e{!O!Q!S!UQ!v!oR!z!vQ!y!pR!|!yQgUR!VgQjVR!YjQmWR![mQpXR!^pQtZR!`tS_O`ToXp",
  nodeNames: "⚠ StartCloseTag StartCloseTag StartCloseTag EndTag SelfClosingEndTag StartTag StartTag StartTag StartTag StartTag StartCloseTag StartCloseTag StartCloseTag IncompleteCloseTag Document Text EntityReference CharacterReference InvalidEntity Element OpenTag TagName Attribute AttributeName Is AttributeValue UnquotedAttributeValue ScriptText CloseTag OpenTag StyleText CloseTag OpenTag TextareaText CloseTag OpenTag CloseTag SelfClosingTag Comment ProcessingInst MismatchedCloseTag CloseTag DoctypeDecl",
  maxTerm: 67,
  context: elementContext,
  nodeProps: [
    ["closedBy", -10,1,2,3,7,8,9,10,11,12,13,"EndTag",6,"EndTag SelfClosingEndTag",-4,21,30,33,36,"CloseTag"],
    ["openedBy", 4,"StartTag StartCloseTag",5,"StartTag",-4,29,32,35,37,"OpenTag"],
    ["group", -9,14,17,18,19,20,39,40,41,42,"Entity",16,"Entity TextContent",-3,28,31,34,"TextContent Entity"],
    ["isolate", -11,21,29,30,32,33,35,36,37,38,41,42,"ltr",-3,26,27,39,""]
  ],
  propSources: [htmlHighlighting],
  skippedNodes: [0],
  repeatNodeCount: 9,
  tokenData: "!<p!aR!YOX$qXY,QYZ,QZ[$q[]&X]^,Q^p$qpq,Qqr-_rs3_sv-_vw3}wxHYx}-_}!OH{!O!P-_!P!Q$q!Q![-_![!]Mz!]!^-_!^!_!$S!_!`!;x!`!a&X!a!c-_!c!}Mz!}#R-_#R#SMz#S#T1k#T#oMz#o#s-_#s$f$q$f%W-_%W%oMz%o%p-_%p&aMz&a&b-_&b1pMz1p4U-_4U4dMz4d4e-_4e$ISMz$IS$I`-_$I`$IbMz$Ib$Kh-_$Kh%#tMz%#t&/x-_&/x&EtMz&Et&FV-_&FV;'SMz;'S;:j!#|;:j;=`3X<%l?&r-_?&r?AhMz?Ah?BY$q?BY?MnMz?MnO$q!Z$|c`PkW!a`!cpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr$qrs&}sv$qvw+Pwx(tx!^$q!^!_*V!_!a&X!a#S$q#S#T&X#T;'S$q;'S;=`+z<%lO$q!R&bX`P!a`!cpOr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&Xq'UV`P!cpOv&}wx'kx!^&}!^!_(V!_;'S&};'S;=`(n<%lO&}P'pT`POv'kw!^'k!_;'S'k;'S;=`(P<%lO'kP(SP;=`<%l'kp([S!cpOv(Vx;'S(V;'S;=`(h<%lO(Vp(kP;=`<%l(Vq(qP;=`<%l&}a({W`P!a`Or(trs'ksv(tw!^(t!^!_)e!_;'S(t;'S;=`*P<%lO(t`)jT!a`Or)esv)ew;'S)e;'S;=`)y<%lO)e`)|P;=`<%l)ea*SP;=`<%l(t!Q*^V!a`!cpOr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!Q*vP;=`<%l*V!R*|P;=`<%l&XW+UYkWOX+PZ[+P^p+Pqr+Psw+Px!^+P!a#S+P#T;'S+P;'S;=`+t<%lO+PW+wP;=`<%l+P!Z+}P;=`<%l$q!a,]``P!a`!cp!^^OX&XXY,QYZ,QZ]&X]^,Q^p&Xpq,Qqr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&X!_-ljhS`PkW!a`!cpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx!P-_!P!Q$q!Q!^-_!^!_*V!_!a&X!a#S-_#S#T1k#T#s-_#s$f$q$f;'S-_;'S;=`3X<%l?Ah-_?Ah?BY$q?BY?Mn-_?MnO$q[/ebhSkWOX+PZ[+P^p+Pqr/^sw/^x!P/^!P!Q+P!Q!^/^!a#S/^#S#T0m#T#s/^#s$f+P$f;'S/^;'S;=`1e<%l?Ah/^?Ah?BY+P?BY?Mn/^?MnO+PS0rXhSqr0msw0mx!P0m!Q!^0m!a#s0m$f;'S0m;'S;=`1_<%l?Ah0m?BY?Mn0mS1bP;=`<%l0m[1hP;=`<%l/^!V1vchS`P!a`!cpOq&Xqr1krs&}sv1kvw0mwx(tx!P1k!P!Q&X!Q!^1k!^!_*V!_!a&X!a#s1k#s$f&X$f;'S1k;'S;=`3R<%l?Ah1k?Ah?BY&X?BY?Mn1k?MnO&X!V3UP;=`<%l1k!_3[P;=`<%l-_!Z3hV!`h`P!cpOv&}wx'kx!^&}!^!_(V!_;'S&};'S;=`(n<%lO&}!_4WihSkWc!ROX5uXZ7SZ[5u[^7S^p5uqr8trs7Sst>]tw8twx7Sx!P8t!P!Q5u!Q!]8t!]!^/^!^!a7S!a#S8t#S#T;{#T#s8t#s$f5u$f;'S8t;'S;=`>V<%l?Ah8t?Ah?BY5u?BY?Mn8t?MnO5u!Z5zbkWOX5uXZ7SZ[5u[^7S^p5uqr5urs7Sst+Ptw5uwx7Sx!]5u!]!^7w!^!a7S!a#S5u#S#T7S#T;'S5u;'S;=`8n<%lO5u!R7VVOp7Sqs7St!]7S!]!^7l!^;'S7S;'S;=`7q<%lO7S!R7qOa!R!R7tP;=`<%l7S!Z8OYkWa!ROX+PZ[+P^p+Pqr+Psw+Px!^+P!a#S+P#T;'S+P;'S;=`+t<%lO+P!Z8qP;=`<%l5u!_8{ihSkWOX5uXZ7SZ[5u[^7S^p5uqr8trs7Sst/^tw8twx7Sx!P8t!P!Q5u!Q!]8t!]!^:j!^!a7S!a#S8t#S#T;{#T#s8t#s$f5u$f;'S8t;'S;=`>V<%l?Ah8t?Ah?BY5u?BY?Mn8t?MnO5u!_:sbhSkWa!ROX+PZ[+P^p+Pqr/^sw/^x!P/^!P!Q+P!Q!^/^!a#S/^#S#T0m#T#s/^#s$f+P$f;'S/^;'S;=`1e<%l?Ah/^?Ah?BY+P?BY?Mn/^?MnO+P!V<QchSOp7Sqr;{rs7Sst0mtw;{wx7Sx!P;{!P!Q7S!Q!];{!]!^=]!^!a7S!a#s;{#s$f7S$f;'S;{;'S;=`>P<%l?Ah;{?Ah?BY7S?BY?Mn;{?MnO7S!V=dXhSa!Rqr0msw0mx!P0m!Q!^0m!a#s0m$f;'S0m;'S;=`1_<%l?Ah0m?BY?Mn0m!V>SP;=`<%l;{!_>YP;=`<%l8t!_>dhhSkWOX@OXZAYZ[@O[^AY^p@OqrBwrsAYswBwwxAYx!PBw!P!Q@O!Q!]Bw!]!^/^!^!aAY!a#SBw#S#TE{#T#sBw#s$f@O$f;'SBw;'S;=`HS<%l?AhBw?Ah?BY@O?BY?MnBw?MnO@O!Z@TakWOX@OXZAYZ[@O[^AY^p@Oqr@OrsAYsw@OwxAYx!]@O!]!^Az!^!aAY!a#S@O#S#TAY#T;'S@O;'S;=`Bq<%lO@O!RA]UOpAYq!]AY!]!^Ao!^;'SAY;'S;=`At<%lOAY!RAtOb!R!RAwP;=`<%lAY!ZBRYkWb!ROX+PZ[+P^p+Pqr+Psw+Px!^+P!a#S+P#T;'S+P;'S;=`+t<%lO+P!ZBtP;=`<%l@O!_COhhSkWOX@OXZAYZ[@O[^AY^p@OqrBwrsAYswBwwxAYx!PBw!P!Q@O!Q!]Bw!]!^Dj!^!aAY!a#SBw#S#TE{#T#sBw#s$f@O$f;'SBw;'S;=`HS<%l?AhBw?Ah?BY@O?BY?MnBw?MnO@O!_DsbhSkWb!ROX+PZ[+P^p+Pqr/^sw/^x!P/^!P!Q+P!Q!^/^!a#S/^#S#T0m#T#s/^#s$f+P$f;'S/^;'S;=`1e<%l?Ah/^?Ah?BY+P?BY?Mn/^?MnO+P!VFQbhSOpAYqrE{rsAYswE{wxAYx!PE{!P!QAY!Q!]E{!]!^GY!^!aAY!a#sE{#s$fAY$f;'SE{;'S;=`G|<%l?AhE{?Ah?BYAY?BY?MnE{?MnOAY!VGaXhSb!Rqr0msw0mx!P0m!Q!^0m!a#s0m$f;'S0m;'S;=`1_<%l?Ah0m?BY?Mn0m!VHPP;=`<%lE{!_HVP;=`<%lBw!ZHcW!bx`P!a`Or(trs'ksv(tw!^(t!^!_)e!_;'S(t;'S;=`*P<%lO(t!aIYlhS`PkW!a`!cpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx}-_}!OKQ!O!P-_!P!Q$q!Q!^-_!^!_*V!_!a&X!a#S-_#S#T1k#T#s-_#s$f$q$f;'S-_;'S;=`3X<%l?Ah-_?Ah?BY$q?BY?Mn-_?MnO$q!aK_khS`PkW!a`!cpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx!P-_!P!Q$q!Q!^-_!^!_*V!_!`&X!`!aMS!a#S-_#S#T1k#T#s-_#s$f$q$f;'S-_;'S;=`3X<%l?Ah-_?Ah?BY$q?BY?Mn-_?MnO$q!TM_X`P!a`!cp!eQOr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&X!aNZ!ZhSfQ`PkW!a`!cpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx}-_}!OMz!O!PMz!P!Q$q!Q![Mz![!]Mz!]!^-_!^!_*V!_!a&X!a!c-_!c!}Mz!}#R-_#R#SMz#S#T1k#T#oMz#o#s-_#s$f$q$f$}-_$}%OMz%O%W-_%W%oMz%o%p-_%p&aMz&a&b-_&b1pMz1p4UMz4U4dMz4d4e-_4e$ISMz$IS$I`-_$I`$IbMz$Ib$Je-_$Je$JgMz$Jg$Kh-_$Kh%#tMz%#t&/x-_&/x&EtMz&Et&FV-_&FV;'SMz;'S;:j!#|;:j;=`3X<%l?&r-_?&r?AhMz?Ah?BY$q?BY?MnMz?MnO$q!a!$PP;=`<%lMz!R!$ZY!a`!cpOq*Vqr!$yrs(Vsv*Vwx)ex!a*V!a!b!4t!b;'S*V;'S;=`*s<%lO*V!R!%Q]!a`!cpOr*Vrs(Vsv*Vwx)ex}*V}!O!%y!O!f*V!f!g!']!g#W*V#W#X!0`#X;'S*V;'S;=`*s<%lO*V!R!&QX!a`!cpOr*Vrs(Vsv*Vwx)ex}*V}!O!&m!O;'S*V;'S;=`*s<%lO*V!R!&vV!a`!cp!dPOr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!R!'dX!a`!cpOr*Vrs(Vsv*Vwx)ex!q*V!q!r!(P!r;'S*V;'S;=`*s<%lO*V!R!(WX!a`!cpOr*Vrs(Vsv*Vwx)ex!e*V!e!f!(s!f;'S*V;'S;=`*s<%lO*V!R!(zX!a`!cpOr*Vrs(Vsv*Vwx)ex!v*V!v!w!)g!w;'S*V;'S;=`*s<%lO*V!R!)nX!a`!cpOr*Vrs(Vsv*Vwx)ex!{*V!{!|!*Z!|;'S*V;'S;=`*s<%lO*V!R!*bX!a`!cpOr*Vrs(Vsv*Vwx)ex!r*V!r!s!*}!s;'S*V;'S;=`*s<%lO*V!R!+UX!a`!cpOr*Vrs(Vsv*Vwx)ex!g*V!g!h!+q!h;'S*V;'S;=`*s<%lO*V!R!+xY!a`!cpOr!+qrs!,hsv!+qvw!-Swx!.[x!`!+q!`!a!/j!a;'S!+q;'S;=`!0Y<%lO!+qq!,mV!cpOv!,hvx!-Sx!`!,h!`!a!-q!a;'S!,h;'S;=`!.U<%lO!,hP!-VTO!`!-S!`!a!-f!a;'S!-S;'S;=`!-k<%lO!-SP!-kO{PP!-nP;=`<%l!-Sq!-xS!cp{POv(Vx;'S(V;'S;=`(h<%lO(Vq!.XP;=`<%l!,ha!.aX!a`Or!.[rs!-Ssv!.[vw!-Sw!`!.[!`!a!.|!a;'S!.[;'S;=`!/d<%lO!.[a!/TT!a`{POr)esv)ew;'S)e;'S;=`)y<%lO)ea!/gP;=`<%l!.[!R!/sV!a`!cp{POr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!R!0]P;=`<%l!+q!R!0gX!a`!cpOr*Vrs(Vsv*Vwx)ex#c*V#c#d!1S#d;'S*V;'S;=`*s<%lO*V!R!1ZX!a`!cpOr*Vrs(Vsv*Vwx)ex#V*V#V#W!1v#W;'S*V;'S;=`*s<%lO*V!R!1}X!a`!cpOr*Vrs(Vsv*Vwx)ex#h*V#h#i!2j#i;'S*V;'S;=`*s<%lO*V!R!2qX!a`!cpOr*Vrs(Vsv*Vwx)ex#m*V#m#n!3^#n;'S*V;'S;=`*s<%lO*V!R!3eX!a`!cpOr*Vrs(Vsv*Vwx)ex#d*V#d#e!4Q#e;'S*V;'S;=`*s<%lO*V!R!4XX!a`!cpOr*Vrs(Vsv*Vwx)ex#X*V#X#Y!+q#Y;'S*V;'S;=`*s<%lO*V!R!4{Y!a`!cpOr!4trs!5ksv!4tvw!6Vwx!8]x!a!4t!a!b!:]!b;'S!4t;'S;=`!;r<%lO!4tq!5pV!cpOv!5kvx!6Vx!a!5k!a!b!7W!b;'S!5k;'S;=`!8V<%lO!5kP!6YTO!a!6V!a!b!6i!b;'S!6V;'S;=`!7Q<%lO!6VP!6lTO!`!6V!`!a!6{!a;'S!6V;'S;=`!7Q<%lO!6VP!7QOxPP!7TP;=`<%l!6Vq!7]V!cpOv!5kvx!6Vx!`!5k!`!a!7r!a;'S!5k;'S;=`!8V<%lO!5kq!7yS!cpxPOv(Vx;'S(V;'S;=`(h<%lO(Vq!8YP;=`<%l!5ka!8bX!a`Or!8]rs!6Vsv!8]vw!6Vw!a!8]!a!b!8}!b;'S!8];'S;=`!:V<%lO!8]a!9SX!a`Or!8]rs!6Vsv!8]vw!6Vw!`!8]!`!a!9o!a;'S!8];'S;=`!:V<%lO!8]a!9vT!a`xPOr)esv)ew;'S)e;'S;=`)y<%lO)ea!:YP;=`<%l!8]!R!:dY!a`!cpOr!4trs!5ksv!4tvw!6Vwx!8]x!`!4t!`!a!;S!a;'S!4t;'S;=`!;r<%lO!4t!R!;]V!a`!cpxPOr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!R!;uP;=`<%l!4t!V!<TXiS`P!a`!cpOr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&X",
  tokenizers: [scriptTokens, styleTokens, textareaTokens, endTag, tagStart, commentContent, 0, 1, 2, 3, 4, 5],
  topRules: {"Document":[0,15]},
  dialects: {noMatch: 0, selfClosing: 509},
  tokenPrec: 511
});

function getAttrs(openTag, input) {
  let attrs = Object.create(null);
  for (let att of openTag.getChildren(Attribute)) {
    let name = att.getChild(AttributeName), value = att.getChild(AttributeValue) || att.getChild(UnquotedAttributeValue);
    if (name) attrs[input.read(name.from, name.to)] =
      !value ? "" : value.type.id == AttributeValue ? input.read(value.from + 1, value.to - 1) : input.read(value.from, value.to);
  }
  return attrs
}

function findTagName(openTag, input) {
  let tagNameNode = openTag.getChild(TagName);
  return tagNameNode ? input.read(tagNameNode.from, tagNameNode.to) : " "
}

function maybeNest(node, input, tags) {
  let attrs;
  for (let tag of tags) {
    if (!tag.attrs || tag.attrs(attrs || (attrs = getAttrs(node.node.parent.firstChild, input))))
      return {parser: tag.parser}
  }
  return null
}

// tags?: {
//   tag: string,
//   attrs?: ({[attr: string]: string}) => boolean,
//   parser: Parser
// }[]
// attributes?: {
//   name: string,
//   tagName?: string,
//   parser: Parser
// }[]
 
function configureNesting(tags = [], attributes = []) {
  let script = [], style = [], textarea = [], other = [];
  for (let tag of tags) {
    let array = tag.tag == "script" ? script : tag.tag == "style" ? style : tag.tag == "textarea" ? textarea : other;
    array.push(tag);
  }
  let attrs = attributes.length ? Object.create(null) : null;
  for (let attr of attributes) (attrs[attr.name] || (attrs[attr.name] = [])).push(attr);

  return parseMixed((node, input) => {
    let id = node.type.id;
    if (id == ScriptText) return maybeNest(node, input, script)
    if (id == StyleText) return maybeNest(node, input, style)
    if (id == TextareaText) return maybeNest(node, input, textarea)

    if (id == Element && other.length) {
      let n = node.node, open = n.firstChild, tagName = open && findTagName(open, input), attrs;
      if (tagName) for (let tag of other) {
        if (tag.tag == tagName && (!tag.attrs || tag.attrs(attrs || (attrs = getAttrs(open, input))))) {
          let close = n.lastChild;
          let to = close.type.id == CloseTag ? close.from : n.to;
          if (to > open.to)
            return {parser: tag.parser, overlay: [{from: open.to, to}]}
        }
      }
    }

    if (attrs && id == Attribute) {
      let n = node.node, nameNode;
      if (nameNode = n.firstChild) {
        let matches = attrs[input.read(nameNode.from, nameNode.to)];
        if (matches) for (let attr of matches) {
          if (attr.tagName && attr.tagName != findTagName(n.parent, input)) continue
          let value = n.lastChild;
          if (value.type.id == AttributeValue) {
            let from = value.from + 1;
            let last = value.lastChild, to = value.to - (last && last.isError ? 0 : 1);
            if (to > from) return {parser: attr.parser, overlay: [{from, to}]}
          } else if (value.type.id == UnquotedAttributeValue) {
            return {parser: attr.parser, overlay: [{from: value.from, to: value.to}]}
          }
        }
      }
    }
    return null
  })
}

const Targets = ["_blank", "_self", "_top", "_parent"];
const Charsets = ["ascii", "utf-8", "utf-16", "latin1", "latin1"];
const Methods = ["get", "post", "put", "delete"];
const Encs = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];
const Bool = ["true", "false"];
const S = {}; // Empty tag spec
const Tags = {
    a: {
        attrs: {
            href: null, ping: null, type: null,
            media: null,
            target: Targets,
            hreflang: null
        }
    },
    abbr: S,
    address: S,
    area: {
        attrs: {
            alt: null, coords: null, href: null, target: null, ping: null,
            media: null, hreflang: null, type: null,
            shape: ["default", "rect", "circle", "poly"]
        }
    },
    article: S,
    aside: S,
    audio: {
        attrs: {
            src: null, mediagroup: null,
            crossorigin: ["anonymous", "use-credentials"],
            preload: ["none", "metadata", "auto"],
            autoplay: ["autoplay"],
            loop: ["loop"],
            controls: ["controls"]
        }
    },
    b: S,
    base: { attrs: { href: null, target: Targets } },
    bdi: S,
    bdo: S,
    blockquote: { attrs: { cite: null } },
    body: S,
    br: S,
    button: {
        attrs: {
            form: null, formaction: null, name: null, value: null,
            autofocus: ["autofocus"],
            disabled: ["autofocus"],
            formenctype: Encs,
            formmethod: Methods,
            formnovalidate: ["novalidate"],
            formtarget: Targets,
            type: ["submit", "reset", "button"]
        }
    },
    canvas: { attrs: { width: null, height: null } },
    caption: S,
    center: S,
    cite: S,
    code: S,
    col: { attrs: { span: null } },
    colgroup: { attrs: { span: null } },
    command: {
        attrs: {
            type: ["command", "checkbox", "radio"],
            label: null, icon: null, radiogroup: null, command: null, title: null,
            disabled: ["disabled"],
            checked: ["checked"]
        }
    },
    data: { attrs: { value: null } },
    datagrid: { attrs: { disabled: ["disabled"], multiple: ["multiple"] } },
    datalist: { attrs: { data: null } },
    dd: S,
    del: { attrs: { cite: null, datetime: null } },
    details: { attrs: { open: ["open"] } },
    dfn: S,
    div: S,
    dl: S,
    dt: S,
    em: S,
    embed: { attrs: { src: null, type: null, width: null, height: null } },
    eventsource: { attrs: { src: null } },
    fieldset: { attrs: { disabled: ["disabled"], form: null, name: null } },
    figcaption: S,
    figure: S,
    footer: S,
    form: {
        attrs: {
            action: null, name: null,
            "accept-charset": Charsets,
            autocomplete: ["on", "off"],
            enctype: Encs,
            method: Methods,
            novalidate: ["novalidate"],
            target: Targets
        }
    },
    h1: S, h2: S, h3: S, h4: S, h5: S, h6: S,
    head: {
        children: ["title", "base", "link", "style", "meta", "script", "noscript", "command"]
    },
    header: S,
    hgroup: S,
    hr: S,
    html: {
        attrs: { manifest: null }
    },
    i: S,
    iframe: {
        attrs: {
            src: null, srcdoc: null, name: null, width: null, height: null,
            sandbox: ["allow-top-navigation", "allow-same-origin", "allow-forms", "allow-scripts"],
            seamless: ["seamless"]
        }
    },
    img: {
        attrs: {
            alt: null, src: null, ismap: null, usemap: null, width: null, height: null,
            crossorigin: ["anonymous", "use-credentials"]
        }
    },
    input: {
        attrs: {
            alt: null, dirname: null, form: null, formaction: null,
            height: null, list: null, max: null, maxlength: null, min: null,
            name: null, pattern: null, placeholder: null, size: null, src: null,
            step: null, value: null, width: null,
            accept: ["audio/*", "video/*", "image/*"],
            autocomplete: ["on", "off"],
            autofocus: ["autofocus"],
            checked: ["checked"],
            disabled: ["disabled"],
            formenctype: Encs,
            formmethod: Methods,
            formnovalidate: ["novalidate"],
            formtarget: Targets,
            multiple: ["multiple"],
            readonly: ["readonly"],
            required: ["required"],
            type: ["hidden", "text", "search", "tel", "url", "email", "password", "datetime", "date", "month",
                "week", "time", "datetime-local", "number", "range", "color", "checkbox", "radio",
                "file", "submit", "image", "reset", "button"]
        }
    },
    ins: { attrs: { cite: null, datetime: null } },
    kbd: S,
    keygen: {
        attrs: {
            challenge: null, form: null, name: null,
            autofocus: ["autofocus"],
            disabled: ["disabled"],
            keytype: ["RSA"]
        }
    },
    label: { attrs: { for: null, form: null } },
    legend: S,
    li: { attrs: { value: null } },
    link: {
        attrs: {
            href: null, type: null,
            hreflang: null,
            media: null,
            sizes: ["all", "16x16", "16x16 32x32", "16x16 32x32 64x64"]
        }
    },
    map: { attrs: { name: null } },
    mark: S,
    menu: { attrs: { label: null, type: ["list", "context", "toolbar"] } },
    meta: {
        attrs: {
            content: null,
            charset: Charsets,
            name: ["viewport", "application-name", "author", "description", "generator", "keywords"],
            "http-equiv": ["content-language", "content-type", "default-style", "refresh"]
        }
    },
    meter: { attrs: { value: null, min: null, low: null, high: null, max: null, optimum: null } },
    nav: S,
    noscript: S,
    object: {
        attrs: {
            data: null, type: null, name: null, usemap: null, form: null, width: null, height: null,
            typemustmatch: ["typemustmatch"]
        }
    },
    ol: { attrs: { reversed: ["reversed"], start: null, type: ["1", "a", "A", "i", "I"] },
        children: ["li", "script", "template", "ul", "ol"] },
    optgroup: { attrs: { disabled: ["disabled"], label: null } },
    option: { attrs: { disabled: ["disabled"], label: null, selected: ["selected"], value: null } },
    output: { attrs: { for: null, form: null, name: null } },
    p: S,
    param: { attrs: { name: null, value: null } },
    pre: S,
    progress: { attrs: { value: null, max: null } },
    q: { attrs: { cite: null } },
    rp: S,
    rt: S,
    ruby: S,
    samp: S,
    script: {
        attrs: {
            type: ["text/javascript"],
            src: null,
            async: ["async"],
            defer: ["defer"],
            charset: Charsets
        }
    },
    section: S,
    select: {
        attrs: {
            form: null, name: null, size: null,
            autofocus: ["autofocus"],
            disabled: ["disabled"],
            multiple: ["multiple"]
        }
    },
    slot: { attrs: { name: null } },
    small: S,
    source: { attrs: { src: null, type: null, media: null } },
    span: S,
    strong: S,
    style: {
        attrs: {
            type: ["text/css"],
            media: null,
            scoped: null
        }
    },
    sub: S,
    summary: S,
    sup: S,
    table: S,
    tbody: S,
    td: { attrs: { colspan: null, rowspan: null, headers: null } },
    template: S,
    textarea: {
        attrs: {
            dirname: null, form: null, maxlength: null, name: null, placeholder: null,
            rows: null, cols: null,
            autofocus: ["autofocus"],
            disabled: ["disabled"],
            readonly: ["readonly"],
            required: ["required"],
            wrap: ["soft", "hard"]
        }
    },
    tfoot: S,
    th: { attrs: { colspan: null, rowspan: null, headers: null, scope: ["row", "col", "rowgroup", "colgroup"] } },
    thead: S,
    time: { attrs: { datetime: null } },
    title: S,
    tr: S,
    track: {
        attrs: {
            src: null, label: null, default: null,
            kind: ["subtitles", "captions", "descriptions", "chapters", "metadata"],
            srclang: null
        }
    },
    ul: { children: ["li", "script", "template", "ul", "ol"] },
    var: S,
    video: {
        attrs: {
            src: null, poster: null, width: null, height: null,
            crossorigin: ["anonymous", "use-credentials"],
            preload: ["auto", "metadata", "none"],
            autoplay: ["autoplay"],
            mediagroup: ["movie"],
            muted: ["muted"],
            controls: ["controls"]
        }
    },
    wbr: S
};
const GlobalAttrs = {
    accesskey: null,
    class: null,
    contenteditable: Bool,
    contextmenu: null,
    dir: ["ltr", "rtl", "auto"],
    draggable: ["true", "false", "auto"],
    dropzone: ["copy", "move", "link", "string:", "file:"],
    hidden: ["hidden"],
    id: null,
    inert: ["inert"],
    itemid: null,
    itemprop: null,
    itemref: null,
    itemscope: ["itemscope"],
    itemtype: null,
    lang: ["ar", "bn", "de", "en-GB", "en-US", "es", "fr", "hi", "id", "ja", "pa", "pt", "ru", "tr", "zh"],
    spellcheck: Bool,
    autocorrect: Bool,
    autocapitalize: Bool,
    style: null,
    tabindex: null,
    title: null,
    translate: ["yes", "no"],
    rel: ["stylesheet", "alternate", "author", "bookmark", "help", "license", "next", "nofollow", "noreferrer", "prefetch", "prev", "search", "tag"],
    role: /*@__PURE__*/"alert application article banner button cell checkbox complementary contentinfo dialog document feed figure form grid gridcell heading img list listbox listitem main navigation region row rowgroup search switch tab table tabpanel textbox timer".split(" "),
    "aria-activedescendant": null,
    "aria-atomic": Bool,
    "aria-autocomplete": ["inline", "list", "both", "none"],
    "aria-busy": Bool,
    "aria-checked": ["true", "false", "mixed", "undefined"],
    "aria-controls": null,
    "aria-describedby": null,
    "aria-disabled": Bool,
    "aria-dropeffect": null,
    "aria-expanded": ["true", "false", "undefined"],
    "aria-flowto": null,
    "aria-grabbed": ["true", "false", "undefined"],
    "aria-haspopup": Bool,
    "aria-hidden": Bool,
    "aria-invalid": ["true", "false", "grammar", "spelling"],
    "aria-label": null,
    "aria-labelledby": null,
    "aria-level": null,
    "aria-live": ["off", "polite", "assertive"],
    "aria-multiline": Bool,
    "aria-multiselectable": Bool,
    "aria-owns": null,
    "aria-posinset": null,
    "aria-pressed": ["true", "false", "mixed", "undefined"],
    "aria-readonly": Bool,
    "aria-relevant": null,
    "aria-required": Bool,
    "aria-selected": ["true", "false", "undefined"],
    "aria-setsize": null,
    "aria-sort": ["ascending", "descending", "none", "other"],
    "aria-valuemax": null,
    "aria-valuemin": null,
    "aria-valuenow": null,
    "aria-valuetext": null
};
const eventAttributes = /*@__PURE__*/("beforeunload copy cut dragstart dragover dragleave dragenter dragend " +
    "drag paste focus blur change click load mousedown mouseenter mouseleave " +
    "mouseup keydown keyup resize scroll unload").split(" ").map(n => "on" + n);
for (let a of eventAttributes)
    GlobalAttrs[a] = null;
class Schema {
    constructor(extraTags, extraAttrs) {
        this.tags = Object.assign(Object.assign({}, Tags), extraTags);
        this.globalAttrs = Object.assign(Object.assign({}, GlobalAttrs), extraAttrs);
        this.allTags = Object.keys(this.tags);
        this.globalAttrNames = Object.keys(this.globalAttrs);
    }
}
Schema.default = /*@__PURE__*/new Schema;
function elementName(doc, tree, max = doc.length) {
    if (!tree)
        return "";
    let tag = tree.firstChild;
    let name = tag && tag.getChild("TagName");
    return name ? doc.sliceString(name.from, Math.min(name.to, max)) : "";
}
function findParentElement(tree, skip = false) {
    for (; tree; tree = tree.parent)
        if (tree.name == "Element") {
            if (skip)
                skip = false;
            else
                return tree;
        }
    return null;
}
function allowedChildren(doc, tree, schema) {
    let parentInfo = schema.tags[elementName(doc, findParentElement(tree))];
    return (parentInfo === null || parentInfo === void 0 ? void 0 : parentInfo.children) || schema.allTags;
}
function openTags(doc, tree) {
    let open = [];
    for (let parent = findParentElement(tree); parent && !parent.type.isTop; parent = findParentElement(parent.parent)) {
        let tagName = elementName(doc, parent);
        if (tagName && parent.lastChild.name == "CloseTag")
            break;
        if (tagName && open.indexOf(tagName) < 0 && (tree.name == "EndTag" || tree.from >= parent.firstChild.to))
            open.push(tagName);
    }
    return open;
}
const identifier = /^[:\-\.\w\u00b7-\uffff]*$/;
function completeTag(state, schema, tree, from, to) {
    let end = /\s*>/.test(state.sliceDoc(to, to + 5)) ? "" : ">";
    let parent = findParentElement(tree, true);
    return { from, to,
        options: allowedChildren(state.doc, parent, schema).map(tagName => ({ label: tagName, type: "type" })).concat(openTags(state.doc, tree).map((tag, i) => ({ label: "/" + tag, apply: "/" + tag + end,
            type: "type", boost: 99 - i }))),
        validFor: /^\/?[:\-\.\w\u00b7-\uffff]*$/ };
}
function completeCloseTag(state, tree, from, to) {
    let end = /\s*>/.test(state.sliceDoc(to, to + 5)) ? "" : ">";
    return { from, to,
        options: openTags(state.doc, tree).map((tag, i) => ({ label: tag, apply: tag + end, type: "type", boost: 99 - i })),
        validFor: identifier };
}
function completeStartTag(state, schema, tree, pos) {
    let options = [], level = 0;
    for (let tagName of allowedChildren(state.doc, tree, schema))
        options.push({ label: "<" + tagName, type: "type" });
    for (let open of openTags(state.doc, tree))
        options.push({ label: "</" + open + ">", type: "type", boost: 99 - level++ });
    return { from: pos, to: pos, options, validFor: /^<\/?[:\-\.\w\u00b7-\uffff]*$/ };
}
function completeAttrName(state, schema, tree, from, to) {
    let elt = findParentElement(tree), info = elt ? schema.tags[elementName(state.doc, elt)] : null;
    let localAttrs = info && info.attrs ? Object.keys(info.attrs) : [];
    let names = info && info.globalAttrs === false ? localAttrs
        : localAttrs.length ? localAttrs.concat(schema.globalAttrNames) : schema.globalAttrNames;
    return { from, to,
        options: names.map(attrName => ({ label: attrName, type: "property" })),
        validFor: identifier };
}
function completeAttrValue(state, schema, tree, from, to) {
    var _a;
    let nameNode = (_a = tree.parent) === null || _a === void 0 ? void 0 : _a.getChild("AttributeName");
    let options = [], token = undefined;
    if (nameNode) {
        let attrName = state.sliceDoc(nameNode.from, nameNode.to);
        let attrs = schema.globalAttrs[attrName];
        if (!attrs) {
            let elt = findParentElement(tree), info = elt ? schema.tags[elementName(state.doc, elt)] : null;
            attrs = (info === null || info === void 0 ? void 0 : info.attrs) && info.attrs[attrName];
        }
        if (attrs) {
            let base = state.sliceDoc(from, to).toLowerCase(), quoteStart = '"', quoteEnd = '"';
            if (/^['"]/.test(base)) {
                token = base[0] == '"' ? /^[^"]*$/ : /^[^']*$/;
                quoteStart = "";
                quoteEnd = state.sliceDoc(to, to + 1) == base[0] ? "" : base[0];
                base = base.slice(1);
                from++;
            }
            else {
                token = /^[^\s<>='"]*$/;
            }
            for (let value of attrs)
                options.push({ label: value, apply: quoteStart + value + quoteEnd, type: "constant" });
        }
    }
    return { from, to, options, validFor: token };
}
function htmlCompletionFor(schema, context) {
    let { state, pos } = context, tree = ext_CodeMirror_v6_lib.syntaxTree(state).resolveInner(pos, -1), around = tree.resolve(pos);
    for (let scan = pos, before; around == tree && (before = tree.childBefore(scan));) {
        let last = before.lastChild;
        if (!last || !last.type.isError || last.from < last.to)
            break;
        around = tree = before;
        scan = last.from;
    }
    if (tree.name == "TagName") {
        return tree.parent && /CloseTag$/.test(tree.parent.name) ? completeCloseTag(state, tree, tree.from, pos)
            : completeTag(state, schema, tree, tree.from, pos);
    }
    else if (tree.name == "StartTag") {
        return completeTag(state, schema, tree, pos, pos);
    }
    else if (tree.name == "StartCloseTag" || tree.name == "IncompleteCloseTag") {
        return completeCloseTag(state, tree, pos, pos);
    }
    else if (tree.name == "OpenTag" || tree.name == "SelfClosingTag" || tree.name == "AttributeName") {
        return completeAttrName(state, schema, tree, tree.name == "AttributeName" ? tree.from : pos, pos);
    }
    else if (tree.name == "Is" || tree.name == "AttributeValue" || tree.name == "UnquotedAttributeValue") {
        return completeAttrValue(state, schema, tree, tree.name == "Is" ? pos : tree.from, pos);
    }
    else if (context.explicit && (around.name == "Element" || around.name == "Text" || around.name == "Document")) {
        return completeStartTag(state, schema, tree, pos);
    }
    else {
        return null;
    }
}
/**
HTML tag completion. Opens and closes tags and attributes in a
context-aware way.
*/
function htmlCompletionSource(context) {
    return htmlCompletionFor(Schema.default, context);
}
/**
Create a completion source for HTML extended with additional tags
or attributes.
*/
function htmlCompletionSourceWith(config) {
    let { extraTags, extraGlobalAttributes: extraAttrs } = config;
    let schema = extraAttrs || extraTags ? new Schema(extraTags, extraAttrs) : Schema.default;
    return (context) => htmlCompletionFor(schema, context);
}

const jsonParser = /*@__PURE__*/javascriptLanguage.parser.configure({ top: "SingleExpression" });
const defaultNesting = [
    { tag: "script",
        attrs: attrs => attrs.type == "text/typescript" || attrs.lang == "ts",
        parser: typescriptLanguage.parser },
    { tag: "script",
        attrs: attrs => attrs.type == "text/babel" || attrs.type == "text/jsx",
        parser: jsxLanguage.parser },
    { tag: "script",
        attrs: attrs => attrs.type == "text/typescript-jsx",
        parser: tsxLanguage.parser },
    { tag: "script",
        attrs(attrs) {
            return /^(importmap|speculationrules|application\/(.+\+)?json)$/i.test(attrs.type);
        },
        parser: jsonParser },
    { tag: "script",
        attrs(attrs) {
            return !attrs.type || /^(?:text|application)\/(?:x-)?(?:java|ecma)script$|^module$|^$/i.test(attrs.type);
        },
        parser: javascriptLanguage.parser },
    { tag: "style",
        attrs(attrs) {
            return (!attrs.lang || attrs.lang == "css") && (!attrs.type || /^(text\/)?(x-)?(stylesheet|css)$/i.test(attrs.type));
        },
        parser: cssLanguage.parser }
];
const defaultAttrs = /*@__PURE__*/[
    { name: "style",
        parser: /*@__PURE__*/cssLanguage.parser.configure({ top: "Styles" }) }
].concat(/*@__PURE__*/eventAttributes.map(name => ({ name, parser: javascriptLanguage.parser })));
/**
A language provider based on the [Lezer HTML
parser](https://github.com/lezer-parser/html), extended with the
JavaScript and CSS parsers to parse the content of `<script>` and
`<style>` tags.
*/
const htmlPlain = /*@__PURE__*/ext_CodeMirror_v6_lib.LRLanguage.define({
    name: "html",
    parser: /*@__PURE__*/parser$1.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_v6_lib.indentNodeProp.add({
                Element(context) {
                    let after = /^(\s*)(<\/)?/.exec(context.textAfter);
                    if (context.node.to <= context.pos + after[0].length)
                        return context.continue();
                    return context.lineIndent(context.node.from) + (after[2] ? 0 : context.unit);
                },
                "OpenTag CloseTag SelfClosingTag"(context) {
                    return context.column(context.node.from) + context.unit;
                },
                Document(context) {
                    if (context.pos + /\s*/.exec(context.textAfter)[0].length < context.node.to)
                        return context.continue();
                    let endElt = null, close;
                    for (let cur = context.node;;) {
                        let last = cur.lastChild;
                        if (!last || last.name != "Element" || last.to != cur.to)
                            break;
                        endElt = cur = last;
                    }
                    if (endElt && !((close = endElt.lastChild) && (close.name == "CloseTag" || close.name == "SelfClosingTag")))
                        return context.lineIndent(endElt.from) + context.unit;
                    return null;
                }
            }),
            /*@__PURE__*/ext_CodeMirror_v6_lib.foldNodeProp.add({
                Element(node) {
                    let first = node.firstChild, last = node.lastChild;
                    if (!first || first.name != "OpenTag")
                        return null;
                    return { from: first.to, to: last.name == "CloseTag" ? last.from : node.to };
                }
            }),
            /*@__PURE__*/ext_CodeMirror_v6_lib.bracketMatchingHandle.add({
                "OpenTag CloseTag": node => node.getChild("TagName")
            })
        ]
    }),
    languageData: {
        commentTokens: { block: { open: "<!--", close: "-->" } },
        indentOnInput: /^\s*<\/\w+\W$/,
        wordChars: "-._"
    }
});
/**
A language provider based on the [Lezer HTML
parser](https://github.com/lezer-parser/html), extended with the
JavaScript and CSS parsers to parse the content of `<script>` and
`<style>` tags.
*/
const htmlLanguage = /*@__PURE__*/htmlPlain.configure({
    wrap: /*@__PURE__*/configureNesting(defaultNesting, defaultAttrs)
});
/**
Language support for HTML, including
[`htmlCompletion`](https://codemirror.net/6/docs/ref/#lang-html.htmlCompletion) and JavaScript and
CSS support extensions.
*/
function html(config = {}) {
    let dialect = "", wrap;
    if (config.matchClosingTags === false)
        dialect = "noMatch";
    if (config.selfClosingTags === true)
        dialect = (dialect ? dialect + " " : "") + "selfClosing";
    if (config.nestedLanguages && config.nestedLanguages.length ||
        config.nestedAttributes && config.nestedAttributes.length)
        wrap = configureNesting((config.nestedLanguages || []).concat(defaultNesting), (config.nestedAttributes || []).concat(defaultAttrs));
    let lang = wrap ? htmlPlain.configure({ wrap, dialect }) : dialect ? htmlLanguage.configure({ dialect }) : htmlLanguage;
    return new ext_CodeMirror_v6_lib.LanguageSupport(lang, [
        htmlLanguage.data.of({ autocomplete: htmlCompletionSourceWith(config) }),
        config.autoCloseTags !== false ? autoCloseTags : [],
        javascript().support,
        css().support
    ]);
}
const selfClosers = /*@__PURE__*/new Set(/*@__PURE__*/"area base br col command embed frame hr img input keygen link meta param source track wbr menuitem".split(" "));
/**
Extension that will automatically insert close tags when a `>` or
`/` is typed.
*/
const autoCloseTags = /*@__PURE__*/ext_CodeMirror_v6_lib.EditorView.inputHandler.of((view, from, to, text, insertTransaction) => {
    if (view.composing || view.state.readOnly || from != to || (text != ">" && text != "/") ||
        !htmlLanguage.isActiveAt(view.state, from, -1))
        return false;
    let base = insertTransaction(), { state } = base;
    let closeTags = state.changeByRange(range => {
        var _a, _b, _c;
        let didType = state.doc.sliceString(range.from - 1, range.to) == text;
        let { head } = range, after = ext_CodeMirror_v6_lib.syntaxTree(state).resolveInner(head, -1), name;
        if (didType && text == ">" && after.name == "EndTag") {
            let tag = after.parent;
            if (((_b = (_a = tag.parent) === null || _a === void 0 ? void 0 : _a.lastChild) === null || _b === void 0 ? void 0 : _b.name) != "CloseTag" &&
                (name = elementName(state.doc, tag.parent, head)) &&
                !selfClosers.has(name)) {
                let to = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0);
                let insert = `</${name}>`;
                return { range, changes: { from: head, to, insert } };
            }
        }
        else if (didType && text == "/" && after.name == "IncompleteCloseTag") {
            let tag = after.parent;
            if (after.from == head - 2 && ((_c = tag.lastChild) === null || _c === void 0 ? void 0 : _c.name) != "CloseTag" &&
                (name = elementName(state.doc, tag, head)) && !selfClosers.has(name)) {
                let to = head + (state.doc.sliceString(head, head + 1) === ">" ? 1 : 0);
                let insert = `${name}>`;
                return {
                    range: ext_CodeMirror_v6_lib.EditorSelection.cursor(head + insert.length, -1),
                    changes: { from: head, to, insert }
                };
            }
        }
        return { range };
    });
    if (closeTags.changes.empty)
        return false;
    view.dispatch([
        base,
        state.update(closeTags, {
            userEvent: "input.complete",
            scrollIntoView: true
        })
    ]);
    return true;
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const parser = /*@__PURE__*/LRParser.deserialize({
  version: 14,
  states: "%pOVOWOOObQPOOOpOSO'#C_OOOO'#Cp'#CpQVOWOOQxQPOOO!TQQOOQ!YQPOOOOOO,58y,58yO!_OSO,58yOOOO-E6n-E6nO!dQQO'#CqQ{QPOOO!iQPOOQ{QPOOO!qQPOOOOOO1G.e1G.eOOQO,59],59]OOQO-E6o-E6oO!yOpO'#CiO#RO`O'#CiQOQPOOO#ZO#tO'#CmO#fO!bO'#CmOOQO,59T,59TO#qOpO,59TO#vO`O,59TOOOO'#Cr'#CrO#{O#tO,59XOOQO,59X,59XOOOO'#Cs'#CsO$WO!bO,59XOOQO1G.o1G.oOOOO-E6p-E6pOOQO1G.s1G.sOOOO-E6q-E6q",
  stateData: "$g~OjOS~OQROUROkQO~OWTOXUOZUO`VO~OSXOTWO~OXUO[]OlZO~OY^O~O[_O~OT`O~OYaO~OmcOodO~OmfOogO~O^iOnhO~O_jOphO~ObkOqkOrmO~OcnOsnOtmO~OnpO~OppO~ObkOqkOrrO~OcnOsnOtrO~OWX`~",
  goto: "!^hPPPiPPPPPPPPPmPPPpPPsy!Q!WTROSRe]Re_QSORYSS[T^Rb[QlfRqlQogRso",
  nodeNames: "⚠ Content Text Interpolation InterpolationContent }} Entity Attribute VueAttributeName : Identifier @ Is ScriptAttributeValue AttributeScript AttributeScript AttributeName AttributeValue Entity Entity",
  maxTerm: 36,
  nodeProps: [
    ["isolate", -3,3,13,17,""]
  ],
  skippedNodes: [0],
  repeatNodeCount: 4,
  tokenData: "'y~RdXY!aYZ!a]^!apq!ars!rwx!w}!O!|!O!P#t!Q![#y![!]$s!_!`%g!b!c%l!c!}#y#R#S#y#T#j#y#j#k%q#k#o#y%W;'S#y;'S;:j$m<%lO#y~!fSj~XY!aYZ!a]^!apq!a~!wOm~~!|Oo~!b#RX`!b}!O!|!Q![!|![!]!|!c!}!|#R#S!|#T#o!|%W;'S!|;'S;:j#n<%lO!|!b#qP;=`<%l!|~#yOl~%W$QXY#t`!b}!O!|!Q![#y![!]!|!c!}#y#R#S#y#T#o#y%W;'S#y;'S;:j$m<%lO#y%W$pP;=`<%l#y~$zXX~`!b}!O!|!Q![!|![!]!|!c!}!|#R#S!|#T#o!|%W;'S!|;'S;:j#n<%lO!|~%lO[~~%qOZ~%W%xXY#t`!b}!O&e!Q![#y![!]!|!c!}#y#R#S#y#T#o#y%W;'S#y;'S;:j$m<%lO#y!b&jX`!b}!O!|!Q![!|![!]!|!c!}'V#R#S!|#T#o'V%W;'S!|;'S;:j#n<%lO!|!b'^XW!b`!b}!O!|!Q![!|![!]!|!c!}'V#R#S!|#T#o'V%W;'S!|;'S;:j#n<%lO!|",
  tokenizers: [6, 7, /*@__PURE__*/new LocalTokenGroup("b~RP#q#rU~XP#q#r[~aOT~~", 17, 4), /*@__PURE__*/new LocalTokenGroup("!k~RQvwX#o#p!_~^TU~Opmq!]m!^;'Sm;'S;=`!X<%lOm~pUOpmq!]m!]!^!S!^;'Sm;'S;=`!X<%lOm~!XOU~~![P;=`<%lm~!bP#o#p!e~!jOk~~", 72, 2), /*@__PURE__*/new LocalTokenGroup("[~RPwxU~ZOp~~", 11, 15), /*@__PURE__*/new LocalTokenGroup("[~RPrsU~ZOn~~", 11, 14), /*@__PURE__*/new LocalTokenGroup("!e~RQvwXwx!_~^Tc~Opmq!]m!^;'Sm;'S;=`!X<%lOm~pUOpmq!]m!]!^!S!^;'Sm;'S;=`!X<%lOm~!XOc~~![P;=`<%lm~!dOt~~", 66, 35), /*@__PURE__*/new LocalTokenGroup("!e~RQrsXvw^~^Or~~cTb~Oprq!]r!^;'Sr;'S;=`!^<%lOr~uUOprq!]r!]!^!X!^;'Sr;'S;=`!^<%lOr~!^Ob~~!aP;=`<%lr~", 66, 33)],
  topRules: {"Content":[0,1],"Attribute":[1,7]},
  tokenPrec: 157
});

const exprParser = /*@__PURE__*/javascriptLanguage.parser.configure({
    top: "SingleExpression"
});
const baseParser = /*@__PURE__*/parser.configure({
    props: [
        /*@__PURE__*/ext_CodeMirror_v6_lib.styleTags({
            Text: ext_CodeMirror_v6_lib.tags.content,
            Is: ext_CodeMirror_v6_lib.tags.definitionOperator,
            AttributeName: ext_CodeMirror_v6_lib.tags.attributeName,
            VueAttributeName: ext_CodeMirror_v6_lib.tags.keyword,
            Identifier: ext_CodeMirror_v6_lib.tags.variableName,
            "AttributeValue ScriptAttributeValue": ext_CodeMirror_v6_lib.tags.attributeValue,
            Entity: ext_CodeMirror_v6_lib.tags.character,
            "{{ }}": ext_CodeMirror_v6_lib.tags.brace,
            "@ :": ext_CodeMirror_v6_lib.tags.punctuation
        })
    ]
});
const exprMixed = { parser: exprParser };
const textParser = /*@__PURE__*/baseParser.configure({
    wrap: /*@__PURE__*/parseMixed((node, input) => node.name == "InterpolationContent" ? exprMixed : null),
});
const attrParser = /*@__PURE__*/baseParser.configure({
    wrap: /*@__PURE__*/parseMixed((node, input) => node.name == "AttributeScript" ? exprMixed : null),
    top: "Attribute"
});
const textMixed = { parser: textParser }, attrMixed = { parser: attrParser };
const baseHTML = /*@__PURE__*/html();
function makeVue(base) {
    return base.configure({
        dialect: "selfClosing",
        wrap: parseMixed(mixVue)
    }, "vue");
}
/**
A language provider for Vue templates.
*/
const vueLanguage = /*@__PURE__*/makeVue(baseHTML.language);
function mixVue(node, input) {
    switch (node.name) {
        case "Attribute":
            return /^(@|:|v-)/.test(input.read(node.from, node.from + 2)) ? attrMixed : null;
        case "Text":
            return textMixed;
    }
    return null;
}
/**
Vue template support.
*/
function vue(config = {}) {
    let base = baseHTML;
    if (config.base) {
        if (config.base.language.name != "html" || !(config.base.language instanceof ext_CodeMirror_v6_lib.LRLanguage))
            throw new RangeError("The base option must be the result of calling html(...)");
        base = config.base;
    }
    return new ext_CodeMirror_v6_lib.LanguageSupport(base.language == baseHTML.language ? vueLanguage : makeVue(base.language), [
        base.support,
        base.language.data.of({ closeBrackets: { brackets: ["{", '"'] } })
    ]);
}

function prefixRE(words) {
  return new RegExp("^(?:" + words.join("|") + ")", "i");
}
function wordRE(words) {
  return new RegExp("^(?:" + words.join("|") + ")$", "i");
}

// long list of standard functions from lua manual
var builtins = wordRE([
  "_G","_VERSION","assert","collectgarbage","dofile","error","getfenv","getmetatable","ipairs","load",
  "loadfile","loadstring","module","next","pairs","pcall","print","rawequal","rawget","rawset","require",
  "select","setfenv","setmetatable","tonumber","tostring","type","unpack","xpcall",

  "coroutine.create","coroutine.resume","coroutine.running","coroutine.status","coroutine.wrap","coroutine.yield",

  "debug.debug","debug.getfenv","debug.gethook","debug.getinfo","debug.getlocal","debug.getmetatable",
  "debug.getregistry","debug.getupvalue","debug.setfenv","debug.sethook","debug.setlocal","debug.setmetatable",
  "debug.setupvalue","debug.traceback",

  "close","flush","lines","read","seek","setvbuf","write",

  "io.close","io.flush","io.input","io.lines","io.open","io.output","io.popen","io.read","io.stderr","io.stdin",
  "io.stdout","io.tmpfile","io.type","io.write",

  "math.abs","math.acos","math.asin","math.atan","math.atan2","math.ceil","math.cos","math.cosh","math.deg",
  "math.exp","math.floor","math.fmod","math.frexp","math.huge","math.ldexp","math.log","math.log10","math.max",
  "math.min","math.modf","math.pi","math.pow","math.rad","math.random","math.randomseed","math.sin","math.sinh",
  "math.sqrt","math.tan","math.tanh",

  "os.clock","os.date","os.difftime","os.execute","os.exit","os.getenv","os.remove","os.rename","os.setlocale",
  "os.time","os.tmpname",

  "package.cpath","package.loaded","package.loaders","package.loadlib","package.path","package.preload",
  "package.seeall",

  "string.byte","string.char","string.dump","string.find","string.format","string.gmatch","string.gsub",
  "string.len","string.lower","string.match","string.rep","string.reverse","string.sub","string.upper",

  "table.concat","table.insert","table.maxn","table.remove","table.sort"
]);
var keywords = wordRE(["and","break","elseif","false","nil","not","or","return",
                       "true","function", "end", "if", "then", "else", "do",
                       "while", "repeat", "until", "for", "in", "local" ]);

var indentTokens = wordRE(["function", "if","repeat","do", "\\(", "{"]);
var dedentTokens = wordRE(["end", "until", "\\)", "}"]);
var dedentPartial = prefixRE(["end", "until", "\\)", "}", "else", "elseif"]);

function readBracket(stream) {
  var level = 0;
  while (stream.eat("=")) ++level;
  stream.eat("[");
  return level;
}

function normal(stream, state) {
  var ch = stream.next();
  if (ch == "-" && stream.eat("-")) {
    if (stream.eat("[") && stream.eat("["))
      return (state.cur = bracketed(readBracket(stream), "comment"))(stream, state);
    stream.skipToEnd();
    return "comment";
  }
  if (ch == "\"" || ch == "'")
    return (state.cur = string(ch))(stream, state);
  if (ch == "[" && /[\[=]/.test(stream.peek()))
    return (state.cur = bracketed(readBracket(stream), "string"))(stream, state);
  if (/\d/.test(ch)) {
    stream.eatWhile(/[\w.%]/);
    return "number";
  }
  if (/[\w_]/.test(ch)) {
    stream.eatWhile(/[\w\\\-_.]/);
    return "variable";
  }
  return null;
}

function bracketed(level, style) {
  return function(stream, state) {
    var curlev = null, ch;
    while ((ch = stream.next()) != null) {
      if (curlev == null) {if (ch == "]") curlev = 0;}
      else if (ch == "=") ++curlev;
      else if (ch == "]" && curlev == level) { state.cur = normal; break; }
      else curlev = null;
    }
    return style;
  };
}

function string(quote) {
  return function(stream, state) {
    var escaped = false, ch;
    while ((ch = stream.next()) != null) {
      if (ch == quote && !escaped) break;
      escaped = !escaped && ch == "\\";
    }
    if (!escaped) state.cur = normal;
    return "string";
  };
}

const lua = {
  name: "lua",

  startState: function() {
    return {basecol: 0, indentDepth: 0, cur: normal};
  },

  token: function(stream, state) {
    if (stream.eatSpace()) return null;
    var style = state.cur(stream, state);
    var word = stream.current();
    if (style == "variable") {
      if (keywords.test(word)) style = "keyword";
      else if (builtins.test(word)) style = "builtin";
    }
    if ((style != "comment") && (style != "string")){
      if (indentTokens.test(word)) ++state.indentDepth;
      else if (dedentTokens.test(word)) --state.indentDepth;
    }
    return style;
  },

  indent: function(state, textAfter, cx) {
    var closing = dedentPartial.test(textAfter);
    return state.basecol + cx.unit * (state.indentDepth - (closing ? 1 : 0));
  },

  languageData: {
    indentOnInput: /^\s*(?:end|until|else|\)|\})$/,
    commentTokens: {line: "--", block: {open: "--[[", close: "]]--"}}
  }
};

exports.ContextTracker = ContextTracker;
exports.DefaultBufferLength = DefaultBufferLength;
exports.ExternalTokenizer = ExternalTokenizer;
exports.InputStream = InputStream;
exports.LRParser = LRParser;
exports.LocalTokenGroup = LocalTokenGroup;
exports.MountedTree = MountedTree;
exports.NodeProp = NodeProp;
exports.NodeSet = NodeSet;
exports.NodeType = NodeType;
exports.NodeWeakMap = NodeWeakMap;
exports.Parser = Parser;
exports.Stack = Stack;
exports.Tree = Tree;
exports.TreeBuffer = TreeBuffer;
exports.TreeCursor = TreeCursor;
exports.TreeFragment = TreeFragment;
exports.completionPath = completionPath;
exports.css = css;
exports.cssCompletionSource = cssCompletionSource;
exports.cssLanguage = cssLanguage;
exports.defineCSSCompletionSource = defineCSSCompletionSource;
exports.esLint = esLint;
exports.html = html;
exports.htmlCompletionSource = htmlCompletionSource;
exports.htmlCompletionSourceWith = htmlCompletionSourceWith;
exports.htmlLanguage = htmlLanguage;
exports.htmlPlain = htmlPlain;
exports.javascript = javascript;
exports.javascriptLanguage = javascriptLanguage;
exports.json = json;
exports.jsonLanguage = jsonLanguage;
exports.jsonParseLinter = jsonParseLinter;
exports.jsxLanguage = jsxLanguage;
exports.localCompletionSource = localCompletionSource;
exports.lua = lua;
exports.parseMixed = parseMixed;
exports.scopeCompletionSource = scopeCompletionSource;
exports.snippets = snippets;
exports.tsxLanguage = tsxLanguage;
exports.typescriptLanguage = typescriptLanguage;
exports.typescriptSnippets = typescriptSnippets;
exports.vue = vue;
exports.vueLanguage = vueLanguage;
