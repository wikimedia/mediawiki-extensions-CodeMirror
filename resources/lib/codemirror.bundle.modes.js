'use strict';

var ext_CodeMirror_lib = require('ext.CodeMirror.lib');

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
const noSemi = 316,
  noSemiType = 317,
  incdec = 1,
  incdecPrefix = 2,
  questionDot = 3,
  JSXStartTag = 4,
  insertSemi = 318,
  spaces = 320,
  newline$1 = 321,
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

const jsHighlight = ext_CodeMirror_lib.styleTags({
  "get set async static": ext_CodeMirror_lib.tags.modifier,
  "for while do if else switch try catch finally return throw break continue default case defer": ext_CodeMirror_lib.tags.controlKeyword,
  "in of await yield void typeof delete instanceof as satisfies": ext_CodeMirror_lib.tags.operatorKeyword,
  "let var const using function class extends": ext_CodeMirror_lib.tags.definitionKeyword,
  "import export from": ext_CodeMirror_lib.tags.moduleKeyword,
  "with debugger new": ext_CodeMirror_lib.tags.keyword,
  TemplateString: ext_CodeMirror_lib.tags.special(ext_CodeMirror_lib.tags.string),
  super: ext_CodeMirror_lib.tags.atom,
  BooleanLiteral: ext_CodeMirror_lib.tags.bool,
  this: ext_CodeMirror_lib.tags.self,
  null: ext_CodeMirror_lib.tags.null,
  Star: ext_CodeMirror_lib.tags.modifier,
  VariableName: ext_CodeMirror_lib.tags.variableName,
  "CallExpression/VariableName TaggedTemplateExpression/VariableName": ext_CodeMirror_lib.tags.function(ext_CodeMirror_lib.tags.variableName),
  VariableDefinition: ext_CodeMirror_lib.tags.definition(ext_CodeMirror_lib.tags.variableName),
  Label: ext_CodeMirror_lib.tags.labelName,
  PropertyName: ext_CodeMirror_lib.tags.propertyName,
  PrivatePropertyName: ext_CodeMirror_lib.tags.special(ext_CodeMirror_lib.tags.propertyName),
  "CallExpression/MemberExpression/PropertyName": ext_CodeMirror_lib.tags.function(ext_CodeMirror_lib.tags.propertyName),
  "FunctionDeclaration/VariableDefinition": ext_CodeMirror_lib.tags.function(ext_CodeMirror_lib.tags.definition(ext_CodeMirror_lib.tags.variableName)),
  "ClassDeclaration/VariableDefinition": ext_CodeMirror_lib.tags.definition(ext_CodeMirror_lib.tags.className),
  "NewExpression/VariableName": ext_CodeMirror_lib.tags.className,
  PropertyDefinition: ext_CodeMirror_lib.tags.definition(ext_CodeMirror_lib.tags.propertyName),
  PrivatePropertyDefinition: ext_CodeMirror_lib.tags.definition(ext_CodeMirror_lib.tags.special(ext_CodeMirror_lib.tags.propertyName)),
  UpdateOp: ext_CodeMirror_lib.tags.updateOperator,
  "LineComment Hashbang": ext_CodeMirror_lib.tags.lineComment,
  BlockComment: ext_CodeMirror_lib.tags.blockComment,
  Number: ext_CodeMirror_lib.tags.number,
  String: ext_CodeMirror_lib.tags.string,
  Escape: ext_CodeMirror_lib.tags.escape,
  ArithOp: ext_CodeMirror_lib.tags.arithmeticOperator,
  LogicOp: ext_CodeMirror_lib.tags.logicOperator,
  BitOp: ext_CodeMirror_lib.tags.bitwiseOperator,
  CompareOp: ext_CodeMirror_lib.tags.compareOperator,
  RegExp: ext_CodeMirror_lib.tags.regexp,
  Equals: ext_CodeMirror_lib.tags.definitionOperator,
  Arrow: ext_CodeMirror_lib.tags.function(ext_CodeMirror_lib.tags.punctuation),
  ": Spread": ext_CodeMirror_lib.tags.punctuation,
  "( )": ext_CodeMirror_lib.tags.paren,
  "[ ]": ext_CodeMirror_lib.tags.squareBracket,
  "{ }": ext_CodeMirror_lib.tags.brace,
  "InterpolationStart InterpolationEnd": ext_CodeMirror_lib.tags.special(ext_CodeMirror_lib.tags.brace),
  ".": ext_CodeMirror_lib.tags.derefOperator,
  ", ;": ext_CodeMirror_lib.tags.separator,
  "@": ext_CodeMirror_lib.tags.meta,

  TypeName: ext_CodeMirror_lib.tags.typeName,
  TypeDefinition: ext_CodeMirror_lib.tags.definition(ext_CodeMirror_lib.tags.typeName),
  "type enum interface implements namespace module declare": ext_CodeMirror_lib.tags.definitionKeyword,
  "abstract global Privacy readonly override": ext_CodeMirror_lib.tags.modifier,
  "is keyof unique infer asserts": ext_CodeMirror_lib.tags.operatorKeyword,

  JSXAttributeValue: ext_CodeMirror_lib.tags.attributeValue,
  JSXText: ext_CodeMirror_lib.tags.content,
  "JSXStartTag JSXStartCloseTag JSXSelfCloseEndTag JSXEndTag": ext_CodeMirror_lib.tags.angleBracket,
  "JSXIdentifier JSXNameSpacedName": ext_CodeMirror_lib.tags.tagName,
  "JSXAttribute/JSXIdentifier JSXAttribute/JSXNameSpacedName": ext_CodeMirror_lib.tags.attributeName,
  "JSXBuiltin/JSXIdentifier": ext_CodeMirror_lib.tags.standard(ext_CodeMirror_lib.tags.tagName)
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const spec_identifier = {__proto__:null,export:20, as:25, from:33, default:36, async:41, function:42, in:52, out:55, const:56, extends:60, this:64, true:72, false:72, null:84, void:88, typeof:92, super:108, new:142, delete:154, yield:163, await:167, class:172, public:235, private:235, protected:235, readonly:237, instanceof:256, satisfies:259, import:292, keyof:349, unique:353, infer:359, asserts:395, is:397, abstract:417, implements:419, type:421, let:424, var:426, using:429, interface:435, enum:439, namespace:445, module:447, declare:451, global:455, defer:471, for:476, of:485, while:488, with:492, do:496, if:500, else:502, switch:506, case:512, try:518, catch:522, finally:526, return:530, throw:534, break:538, continue:542, debugger:546};
const spec_word = {__proto__:null,async:129, get:131, set:133, declare:195, public:197, private:197, protected:197, static:199, abstract:201, override:203, readonly:209, accessor:211, new:401};
const spec_LessThan = {__proto__:null,"<":193};
const parser$4 = LRParser.deserialize({
  version: 14,
  states: "$F|Q%TQlOOO%[QlOOO'_QpOOP(lO`OOO*zQ!0MxO'#CiO+RO#tO'#CjO+aO&jO'#CjO+oO#@ItO'#DaO.QQlO'#DgO.bQlO'#DrO%[QlO'#DzO0fQlO'#ESOOQ!0Lf'#E['#E[O1PQ`O'#EXOOQO'#Ep'#EpOOQO'#Il'#IlO1XQ`O'#GsO1dQ`O'#EoO1iQ`O'#EoO3hQ!0MxO'#JrO6[Q!0MxO'#JsO6uQ`O'#F]O6zQ,UO'#FtOOQ!0Lf'#Ff'#FfO7VO7dO'#FfO9XQMhO'#F|O9`Q`O'#F{OOQ!0Lf'#Js'#JsOOQ!0Lb'#Jr'#JrO9eQ`O'#GwOOQ['#K_'#K_O9pQ`O'#IYO9uQ!0LrO'#IZOOQ['#J`'#J`OOQ['#I_'#I_Q`QlOOQ`QlOOO9}Q!L^O'#DvO:UQlO'#EOO:]QlO'#EQO9kQ`O'#GsO:dQMhO'#CoO:rQ`O'#EnO:}Q`O'#EyO;hQMhO'#FeO;xQ`O'#GsOOQO'#K`'#K`O;}Q`O'#K`O<]Q`O'#G{O<]Q`O'#G|O<]Q`O'#HOO9kQ`O'#HRO=SQ`O'#HUO>kQ`O'#CeO>{Q`O'#HcO?TQ`O'#HiO?TQ`O'#HkO`QlO'#HmO?TQ`O'#HoO?TQ`O'#HrO?YQ`O'#HxO?_Q!0LsO'#IOO%[QlO'#IQO?jQ!0LsO'#ISO?uQ!0LsO'#IUO9uQ!0LrO'#IWO@QQ!0MxO'#CiOASQpO'#DlQOQ`OOO%[QlO'#EQOAjQ`O'#ETO:dQMhO'#EnOAuQ`O'#EnOBQQ!bO'#FeOOQ['#Cg'#CgOOQ!0Lb'#Dq'#DqOOQ!0Lb'#Jv'#JvO%[QlO'#JvOOQO'#Jy'#JyOOQO'#Ih'#IhOCQQpO'#EgOOQ!0Lb'#Ef'#EfOOQ!0Lb'#J}'#J}OC|Q!0MSO'#EgODWQpO'#EWOOQO'#Jx'#JxODlQpO'#JyOEyQpO'#EWODWQpO'#EgPFWO&2DjO'#CbPOOO)CD})CD}OOOO'#I`'#I`OFcO#tO,59UOOQ!0Lh,59U,59UOOOO'#Ia'#IaOFqO&jO,59UOGPQ!L^O'#DcOOOO'#Ic'#IcOGWO#@ItO,59{OOQ!0Lf,59{,59{OGfQlO'#IdOGyQ`O'#JtOIxQ!fO'#JtO+}QlO'#JtOJPQ`O,5:ROJgQ`O'#EpOJtQ`O'#KTOKPQ`O'#KSOKPQ`O'#KSOKXQ`O,5;^OK^Q`O'#KROOQ!0Ln,5:^,5:^OKeQlO,5:^OMcQ!0MxO,5:fONSQ`O,5:nONmQ!0LrO'#KQONtQ`O'#KPO9eQ`O'#KPO! YQ`O'#KPO! bQ`O,5;]O! gQ`O'#KPO!#lQ!fO'#JsOOQ!0Lh'#Ci'#CiO%[QlO'#ESO!$[Q!fO,5:sOOQS'#Jz'#JzOOQO-E<j-E<jO9kQ`O,5=_O!$rQ`O,5=_O!$wQlO,5;ZO!&zQMhO'#EkO!(eQ`O,5;ZO!(jQlO'#DyO!(tQpO,5;dO!(|QpO,5;dO%[QlO,5;dOOQ['#FT'#FTOOQ['#FV'#FVO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eO%[QlO,5;eOOQ['#FZ'#FZO!)[QlO,5;tOOQ!0Lf,5;y,5;yOOQ!0Lf,5;z,5;zOOQ!0Lf,5;|,5;|O%[QlO'#IpO!+_Q!0LrO,5<iO%[QlO,5;eO!&zQMhO,5;eO!+|QMhO,5;eO!-nQMhO'#E^O%[QlO,5;wOOQ!0Lf,5;{,5;{O!-uQ,UO'#FjO!.rQ,UO'#KXO!.^Q,UO'#KXO!.yQ,UO'#KXOOQO'#KX'#KXO!/_Q,UO,5<SOOOW,5<`,5<`O!/pQlO'#FvOOOW'#Io'#IoO7VO7dO,5<QO!/wQ,UO'#FxOOQ!0Lf,5<Q,5<QO!0hQ$IUO'#CyOOQ!0Lh'#C}'#C}O!0{O#@ItO'#DRO!1iQMjO,5<eO!1pQ`O,5<hO!3YQ(CWO'#GXO!3jQ`O'#GYO!3oQ`O'#GYO!5_Q(CWO'#G^O!6dQpO'#GbOOQO'#Gn'#GnO!,TQMhO'#GmOOQO'#Gp'#GpO!,TQMhO'#GoO!7VQ$IUO'#JlOOQ!0Lh'#Jl'#JlO!7aQ`O'#JkO!7oQ`O'#JjO!7wQ`O'#CuOOQ!0Lh'#C{'#C{O!8YQ`O'#C}OOQ!0Lh'#DV'#DVOOQ!0Lh'#DX'#DXO!8_Q`O,5<eO1SQ`O'#DZO!,TQMhO'#GPO!,TQMhO'#GRO!8gQ`O'#GTO!8lQ`O'#GUO!3oQ`O'#G[O!,TQMhO'#GaO<]Q`O'#JkO!8qQ`O'#EqO!9`Q`O,5<gOOQ!0Lb'#Cr'#CrO!9hQ`O'#ErO!:bQpO'#EsOOQ!0Lb'#KR'#KRO!:iQ!0LrO'#KaO9uQ!0LrO,5=cO`QlO,5>tOOQ['#Jh'#JhOOQ[,5>u,5>uOOQ[-E<]-E<]O!<hQ!0MxO,5:bO!:]QpO,5:`O!?RQ!0MxO,5:jO%[QlO,5:jO!AiQ!0MxO,5:lOOQO,5@z,5@zO!BYQMhO,5=_O!BhQ!0LrO'#JiO9`Q`O'#JiO!ByQ!0LrO,59ZO!CUQpO,59ZO!C^QMhO,59ZO:dQMhO,59ZO!CiQ`O,5;ZO!CqQ`O'#HbO!DVQ`O'#KdO%[QlO,5;}O!:]QpO,5<PO!D_Q`O,5=zO!DdQ`O,5=zO!DiQ`O,5=zO!DwQ`O,5=zO9uQ!0LrO,5=zO<]Q`O,5=jOOQO'#Cy'#CyO!EOQpO,5=gO!EWQMhO,5=hO!EcQ`O,5=jO!EhQ!bO,5=mO!EpQ`O'#K`O?YQ`O'#HWO9kQ`O'#HYO!EuQ`O'#HYO:dQMhO'#H[O!EzQ`O'#H[OOQ[,5=p,5=pO!FPQ`O'#H]O!FbQ`O'#CoO!FgQ`O,59PO!FqQ`O,59PO!HvQlO,59POOQ[,59P,59PO!IWQ!0LrO,59PO%[QlO,59PO!KcQlO'#HeOOQ['#Hf'#HfOOQ['#Hg'#HgO`QlO,5=}O!KyQ`O,5=}O`QlO,5>TO`QlO,5>VO!LOQ`O,5>XO`QlO,5>ZO!LTQ`O,5>^O!LYQlO,5>dOOQ[,5>j,5>jO%[QlO,5>jO9uQ!0LrO,5>lOOQ[,5>n,5>nO#!dQ`O,5>nOOQ[,5>p,5>pO#!dQ`O,5>pOOQ[,5>r,5>rO##QQpO'#D_O%[QlO'#JvO##sQpO'#JvO##}QpO'#DmO#$`QpO'#DmO#&qQlO'#DmO#&xQ`O'#JuO#'QQ`O,5:WO#'VQ`O'#EtO#'eQ`O'#KUO#'mQ`O,5;_O#'rQpO'#DmO#(PQpO'#EVOOQ!0Lf,5:o,5:oO%[QlO,5:oO#(WQ`O,5:oO?YQ`O,5;YO!CUQpO,5;YO!C^QMhO,5;YO:dQMhO,5;YO#(`Q`O,5@bO#(eQ07dO,5:sOOQO-E<f-E<fO#)kQ!0MSO,5;RODWQpO,5:rO#)uQpO,5:rODWQpO,5;RO!ByQ!0LrO,5:rOOQ!0Lb'#Ej'#EjOOQO,5;R,5;RO%[QlO,5;RO#*SQ!0LrO,5;RO#*_Q!0LrO,5;RO!CUQpO,5:rOOQO,5;X,5;XO#*mQ!0LrO,5;RPOOO'#I^'#I^P#+RO&2DjO,58|POOO,58|,58|OOOO-E<^-E<^OOQ!0Lh1G.p1G.pOOOO-E<_-E<_OOOO,59},59}O#+^Q!bO,59}OOOO-E<a-E<aOOQ!0Lf1G/g1G/gO#+cQ!fO,5?OO+}QlO,5?OOOQO,5?U,5?UO#+mQlO'#IdOOQO-E<b-E<bO#+zQ`O,5@`O#,SQ!fO,5@`O#,ZQ`O,5@nOOQ!0Lf1G/m1G/mO%[QlO,5@oO#,cQ`O'#IjOOQO-E<h-E<hO#,ZQ`O,5@nOOQ!0Lb1G0x1G0xOOQ!0Ln1G/x1G/xOOQ!0Ln1G0Y1G0YO%[QlO,5@lO#,wQ!0LrO,5@lO#-YQ!0LrO,5@lO#-aQ`O,5@kO9eQ`O,5@kO#-iQ`O,5@kO#-wQ`O'#ImO#-aQ`O,5@kOOQ!0Lb1G0w1G0wO!(tQpO,5:uO!)PQpO,5:uOOQS,5:w,5:wO#.iQdO,5:wO#.qQMhO1G2yO9kQ`O1G2yOOQ!0Lf1G0u1G0uO#/PQ!0MxO1G0uO#0UQ!0MvO,5;VOOQ!0Lh'#GW'#GWO#0rQ!0MzO'#JlO!$wQlO1G0uO#2}Q!fO'#JwO%[QlO'#JwO#3XQ`O,5:eOOQ!0Lh'#D_'#D_OOQ!0Lf1G1O1G1OO%[QlO1G1OOOQ!0Lf1G1f1G1fO#3^Q`O1G1OO#5rQ!0MxO1G1PO#5yQ!0MxO1G1PO#8aQ!0MxO1G1PO#8hQ!0MxO1G1PO#;OQ!0MxO1G1PO#=fQ!0MxO1G1PO#=mQ!0MxO1G1PO#=tQ!0MxO1G1PO#@[Q!0MxO1G1PO#@cQ!0MxO1G1PO#BpQ?MtO'#CiO#DkQ?MtO1G1`O#DrQ?MtO'#JsO#EVQ!0MxO,5?[OOQ!0Lb-E<n-E<nO#GdQ!0MxO1G1PO#HaQ!0MzO1G1POOQ!0Lf1G1P1G1PO#IdQMjO'#J|O#InQ`O,5:xO#IsQ!0MxO1G1cO#JgQ,UO,5<WO#JoQ,UO,5<XO#JwQ,UO'#FoO#K`Q`O'#FnOOQO'#KY'#KYOOQO'#In'#InO#KeQ,UO1G1nOOQ!0Lf1G1n1G1nOOOW1G1y1G1yO#KvQ?MtO'#JrO#LQQ`O,5<bO!)[QlO,5<bOOOW-E<m-E<mOOQ!0Lf1G1l1G1lO#LVQpO'#KXOOQ!0Lf,5<d,5<dO#L_QpO,5<dO#LdQMhO'#DTOOOO'#Ib'#IbO#LkO#@ItO,59mOOQ!0Lh,59m,59mO%[QlO1G2PO!8lQ`O'#IrO#LvQ`O,5<zOOQ!0Lh,5<w,5<wO!,TQMhO'#IuO#MdQMjO,5=XO!,TQMhO'#IwO#NVQMjO,5=ZO!&zQMhO,5=]OOQO1G2S1G2SO#NaQ!dO'#CrO#NtQ(CWO'#ErO$ |QpO'#GbO$!dQ!dO,5<sO$!kQ`O'#K[O9eQ`O'#K[O$!yQ`O,5<uO$#aQ!dO'#C{O!,TQMhO,5<tO$#kQ`O'#GZO$$PQ`O,5<tO$$UQ!dO'#GWO$$cQ!dO'#K]O$$mQ`O'#K]O!&zQMhO'#K]O$$rQ`O,5<xO$$wQlO'#JvO$%RQpO'#GcO#$`QpO'#GcO$%dQ`O'#GgO!3oQ`O'#GkO$%iQ!0LrO'#ItO$%tQpO,5<|OOQ!0Lp,5<|,5<|O$%{QpO'#GcO$&YQpO'#GdO$&kQpO'#GdO$&pQMjO,5=XO$'QQMjO,5=ZOOQ!0Lh,5=^,5=^O!,TQMhO,5@VO!,TQMhO,5@VO$'bQ`O'#IyO$'vQ`O,5@UO$(OQ`O,59aOOQ!0Lh,59i,59iO$(TQ`O,5@VO$)TQ$IYO,59uOOQ!0Lh'#Jp'#JpO$)vQMjO,5<kO$*iQMjO,5<mO@zQ`O,5<oOOQ!0Lh,5<p,5<pO$*sQ`O,5<vO$*xQMjO,5<{O$+YQ`O'#KPO!$wQlO1G2RO$+_Q`O1G2RO9eQ`O'#KSO9eQ`O'#EtO%[QlO'#EtO9eQ`O'#I{O$+dQ!0LrO,5@{OOQ[1G2}1G2}OOQ[1G4`1G4`OOQ!0Lf1G/|1G/|OOQ!0Lf1G/z1G/zO$-fQ!0MxO1G0UOOQ[1G2y1G2yO!&zQMhO1G2yO%[QlO1G2yO#.tQ`O1G2yO$/jQMhO'#EkOOQ!0Lb,5@T,5@TO$/wQ!0LrO,5@TOOQ[1G.u1G.uO!ByQ!0LrO1G.uO!CUQpO1G.uO!C^QMhO1G.uO$0YQ`O1G0uO$0_Q`O'#CiO$0jQ`O'#KeO$0rQ`O,5=|O$0wQ`O'#KeO$0|Q`O'#KeO$1[Q`O'#JRO$1jQ`O,5AOO$1rQ!fO1G1iOOQ!0Lf1G1k1G1kO9kQ`O1G3fO@zQ`O1G3fO$1yQ`O1G3fO$2OQ`O1G3fO!DiQ`O1G3fO9uQ!0LrO1G3fOOQ[1G3f1G3fO!EcQ`O1G3UO!&zQMhO1G3RO$2TQ`O1G3ROOQ[1G3S1G3SO!&zQMhO1G3SO$2YQ`O1G3SO$2bQpO'#HQOOQ[1G3U1G3UO!6_QpO'#I}O!EhQ!bO1G3XOOQ[1G3X1G3XOOQ[,5=r,5=rO$2jQMhO,5=tO9kQ`O,5=tO$%dQ`O,5=vO9`Q`O,5=vO!CUQpO,5=vO!C^QMhO,5=vO:dQMhO,5=vO$2xQ`O'#KcO$3TQ`O,5=wOOQ[1G.k1G.kO$3YQ!0LrO1G.kO@zQ`O1G.kO$3eQ`O1G.kO9uQ!0LrO1G.kO$5mQ!fO,5AQO$5zQ`O,5AQO9eQ`O,5AQO$6VQlO,5>PO$6^Q`O,5>POOQ[1G3i1G3iO`QlO1G3iOOQ[1G3o1G3oOOQ[1G3q1G3qO?TQ`O1G3sO$6cQlO1G3uO$:gQlO'#HtOOQ[1G3x1G3xO$:tQ`O'#HzO?YQ`O'#H|OOQ[1G4O1G4OO$:|QlO1G4OO9uQ!0LrO1G4UOOQ[1G4W1G4WOOQ!0Lb'#G_'#G_O9uQ!0LrO1G4YO9uQ!0LrO1G4[O$?TQ`O,5@bO!)[QlO,5;`O9eQ`O,5;`O?YQ`O,5:XO!)[QlO,5:XO!CUQpO,5:XO$?YQ?MtO,5:XOOQO,5;`,5;`O$?dQpO'#IeO$?zQ`O,5@aOOQ!0Lf1G/r1G/rO$@SQpO'#IkO$@^Q`O,5@pOOQ!0Lb1G0y1G0yO#$`QpO,5:XOOQO'#Ig'#IgO$@fQpO,5:qOOQ!0Ln,5:q,5:qO#(ZQ`O1G0ZOOQ!0Lf1G0Z1G0ZO%[QlO1G0ZOOQ!0Lf1G0t1G0tO?YQ`O1G0tO!CUQpO1G0tO!C^QMhO1G0tOOQ!0Lb1G5|1G5|O!ByQ!0LrO1G0^OOQO1G0m1G0mO%[QlO1G0mO$@mQ!0LrO1G0mO$@xQ!0LrO1G0mO!CUQpO1G0^ODWQpO1G0^O$AWQ!0LrO1G0mOOQO1G0^1G0^O$AlQ!0MxO1G0mPOOO-E<[-E<[POOO1G.h1G.hOOOO1G/i1G/iO$AvQ!bO,5<iO$BOQ!fO1G4jOOQO1G4p1G4pO%[QlO,5?OO$BYQ`O1G5zO$BbQ`O1G6YO$BjQ!fO1G6ZO9eQ`O,5?UO$BtQ!0MxO1G6WO%[QlO1G6WO$CUQ!0LrO1G6WO$CgQ`O1G6VO$CgQ`O1G6VO9eQ`O1G6VO$CoQ`O,5?XO9eQ`O,5?XOOQO,5?X,5?XO$DTQ`O,5?XO$+YQ`O,5?XOOQO-E<k-E<kOOQS1G0a1G0aOOQS1G0c1G0cO#.lQ`O1G0cOOQ[7+(e7+(eO!&zQMhO7+(eO%[QlO7+(eO$DcQ`O7+(eO$DnQMhO7+(eO$D|Q!0MzO,5=XO$GXQ!0MzO,5=ZO$IdQ!0MzO,5=XO$KuQ!0MzO,5=ZO$NWQ!0MzO,59uO%!]Q!0MzO,5<kO%$hQ!0MzO,5<mO%&sQ!0MzO,5<{OOQ!0Lf7+&a7+&aO%)UQ!0MxO7+&aO%)xQlO'#IfO%*VQ`O,5@cO%*_Q!fO,5@cOOQ!0Lf1G0P1G0PO%*iQ`O7+&jOOQ!0Lf7+&j7+&jO%*nQ?MtO,5:fO%[QlO7+&zO%*xQ?MtO,5:bO%+VQ?MtO,5:jO%+aQ?MtO,5:lO%+kQMhO'#IiO%+uQ`O,5@hOOQ!0Lh1G0d1G0dOOQO1G1r1G1rOOQO1G1s1G1sO%+}Q!jO,5<ZO!)[QlO,5<YOOQO-E<l-E<lOOQ!0Lf7+'Y7+'YOOOW7+'e7+'eOOOW1G1|1G1|O%,YQ`O1G1|OOQ!0Lf1G2O1G2OOOOO,59o,59oO%,_Q!dO,59oOOOO-E<`-E<`OOQ!0Lh1G/X1G/XO%,fQ!0MxO7+'kOOQ!0Lh,5?^,5?^O%-YQMhO1G2fP%-aQ`O'#IrPOQ!0Lh-E<p-E<pO%-}QMjO,5?aOOQ!0Lh-E<s-E<sO%.pQMjO,5?cOOQ!0Lh-E<u-E<uO%.zQ!dO1G2wO%/RQ!dO'#CrO%/iQMhO'#KSO$$wQlO'#JvOOQ!0Lh1G2_1G2_O%/sQ`O'#IqO%0[Q`O,5@vO%0[Q`O,5@vO%0dQ`O,5@vO%0oQ`O,5@vOOQO1G2a1G2aO%0}QMjO1G2`O$+YQ`O'#K[O!,TQMhO1G2`O%1_Q(CWO'#IsO%1lQ`O,5@wO!&zQMhO,5@wO%1tQ!dO,5@wOOQ!0Lh1G2d1G2dO%4UQ!fO'#CiO%4`Q`O,5=POOQ!0Lb,5<},5<}O%4hQpO,5<}OOQ!0Lb,5=O,5=OOCwQ`O,5<}O%4sQpO,5<}OOQ!0Lb,5=R,5=RO$+YQ`O,5=VOOQO,5?`,5?`OOQO-E<r-E<rOOQ!0Lp1G2h1G2hO#$`QpO,5<}O$$wQlO,5=PO%5RQ`O,5=OO%5^QpO,5=OO!,TQMhO'#IuO%6WQMjO1G2sO!,TQMhO'#IwO%6yQMjO1G2uO%7TQMjO1G5qO%7_QMjO1G5qOOQO,5?e,5?eOOQO-E<w-E<wOOQO1G.{1G.{O!,TQMhO1G5qO!,TQMhO1G5qO!:]QpO,59wO%[QlO,59wOOQ!0Lh,5<j,5<jO%7lQ`O1G2ZO!,TQMhO1G2bO%7qQ!0MxO7+'mOOQ!0Lf7+'m7+'mO!$wQlO7+'mO%8eQ`O,5;`OOQ!0Lb,5?g,5?gOOQ!0Lb-E<y-E<yO%8jQ!dO'#K^O#(ZQ`O7+(eO4UQ!fO7+(eO$DfQ`O7+(eO%8tQ!0MvO'#CiO%9XQ!0MvO,5=SO%9lQ`O,5=SO%9tQ`O,5=SOOQ!0Lb1G5o1G5oOOQ[7+$a7+$aO!ByQ!0LrO7+$aO!CUQpO7+$aO!$wQlO7+&aO%9yQ`O'#JQO%:bQ`O,5APOOQO1G3h1G3hO9kQ`O,5APO%:bQ`O,5APO%:jQ`O,5APOOQO,5?m,5?mOOQO-E=P-E=POOQ!0Lf7+'T7+'TO%:oQ`O7+)QO9uQ!0LrO7+)QO9kQ`O7+)QO@zQ`O7+)QO%:tQ`O7+)QOOQ[7+)Q7+)QOOQ[7+(p7+(pO%:yQ!0MvO7+(mO!&zQMhO7+(mO!E^Q`O7+(nOOQ[7+(n7+(nO!&zQMhO7+(nO%;TQ`O'#KbO%;`Q`O,5=lOOQO,5?i,5?iOOQO-E<{-E<{OOQ[7+(s7+(sO%<rQpO'#HZOOQ[1G3`1G3`O!&zQMhO1G3`O%[QlO1G3`O%<yQ`O1G3`O%=UQMhO1G3`O9uQ!0LrO1G3bO$%dQ`O1G3bO9`Q`O1G3bO!CUQpO1G3bO!C^QMhO1G3bO%=dQ`O'#JPO%=xQ`O,5@}O%>QQpO,5@}OOQ!0Lb1G3c1G3cOOQ[7+$V7+$VO@zQ`O7+$VO9uQ!0LrO7+$VO%>]Q`O7+$VO%[QlO1G6lO%[QlO1G6mO%>bQ!0LrO1G6lO%>lQlO1G3kO%>sQ`O1G3kO%>xQlO1G3kOOQ[7+)T7+)TO9uQ!0LrO7+)_O`QlO7+)aOOQ['#Kh'#KhOOQ['#JS'#JSO%?PQlO,5>`OOQ[,5>`,5>`O%[QlO'#HuO%?^Q`O'#HwOOQ[,5>f,5>fO9eQ`O,5>fOOQ[,5>h,5>hOOQ[7+)j7+)jOOQ[7+)p7+)pOOQ[7+)t7+)tOOQ[7+)v7+)vO%?cQpO1G5|O%?}Q?MtO1G0zO%@XQ`O1G0zOOQO1G/s1G/sO%@dQ?MtO1G/sO?YQ`O1G/sO!)[QlO'#DmOOQO,5?P,5?POOQO-E<c-E<cOOQO,5?V,5?VOOQO-E<i-E<iO!CUQpO1G/sOOQO-E<e-E<eOOQ!0Ln1G0]1G0]OOQ!0Lf7+%u7+%uO#(ZQ`O7+%uOOQ!0Lf7+&`7+&`O?YQ`O7+&`O!CUQpO7+&`OOQO7+%x7+%xO$AlQ!0MxO7+&XOOQO7+&X7+&XO%[QlO7+&XO%@nQ!0LrO7+&XO!ByQ!0LrO7+%xO!CUQpO7+%xO%@yQ!0LrO7+&XO%AXQ!0MxO7++rO%[QlO7++rO%AiQ`O7++qO%AiQ`O7++qOOQO1G4s1G4sO9eQ`O1G4sO%AqQ`O1G4sOOQS7+%}7+%}O#(ZQ`O<<LPO4UQ!fO<<LPO%BPQ`O<<LPOOQ[<<LP<<LPO!&zQMhO<<LPO%[QlO<<LPO%BXQ`O<<LPO%BdQ!0MzO,5?aO%DoQ!0MzO,5?cO%FzQ!0MzO1G2`O%I]Q!0MzO1G2sO%KhQ!0MzO1G2uO%MsQ!fO,5?QO%[QlO,5?QOOQO-E<d-E<dO%M}Q`O1G5}OOQ!0Lf<<JU<<JUO%NVQ?MtO1G0uO&!^Q?MtO1G1PO&!eQ?MtO1G1PO&$fQ?MtO1G1PO&$mQ?MtO1G1PO&&nQ?MtO1G1PO&(oQ?MtO1G1PO&(vQ?MtO1G1PO&(}Q?MtO1G1PO&+OQ?MtO1G1PO&+VQ?MtO1G1PO&+^Q!0MxO<<JfO&-UQ?MtO1G1PO&.RQ?MvO1G1PO&/UQ?MvO'#JlO&1[Q?MtO1G1cO&1iQ?MtO1G0UO&1sQMjO,5?TOOQO-E<g-E<gO!)[QlO'#FqOOQO'#KZ'#KZOOQO1G1u1G1uO&1}Q`O1G1tO&2SQ?MtO,5?[OOOW7+'h7+'hOOOO1G/Z1G/ZO&2^Q!dO1G4xOOQ!0Lh7+(Q7+(QP!&zQMhO,5?^O!,TQMhO7+(cO&2eQ`O,5?]O9eQ`O,5?]O$+YQ`O,5?]OOQO-E<o-E<oO&2sQ`O1G6bO&2sQ`O1G6bO&2{Q`O1G6bO&3WQMjO7+'zO&3hQ!dO,5?_O&3rQ`O,5?_O!&zQMhO,5?_OOQO-E<q-E<qO&3wQ!dO1G6cO&4RQ`O1G6cO&4ZQ`O1G2kO!&zQMhO1G2kOOQ!0Lb1G2i1G2iOOQ!0Lb1G2j1G2jO%4hQpO1G2iO!CUQpO1G2iOCwQ`O1G2iOOQ!0Lb1G2q1G2qO&4`QpO1G2iO&4nQ`O1G2kO$+YQ`O1G2jOCwQ`O1G2jO$$wQlO1G2kO&4vQ`O1G2jO&5jQMjO,5?aOOQ!0Lh-E<t-E<tO&6]QMjO,5?cOOQ!0Lh-E<v-E<vO!,TQMhO7++]O&6gQMjO7++]O&6qQMjO7++]OOQ!0Lh1G/c1G/cO&7OQ`O1G/cOOQ!0Lh7+'u7+'uO&7TQMjO7+'|O&7eQ!0MxO<<KXOOQ!0Lf<<KX<<KXO&8XQ`O1G0zO!&zQMhO'#IzO&8^Q`O,5@xO&:`Q!fO<<LPO!&zQMhO1G2nO&:gQ!0LrO1G2nOOQ[<<G{<<G{O!ByQ!0LrO<<G{O&:xQ!0MxO<<I{OOQ!0Lf<<I{<<I{OOQO,5?l,5?lO&;lQ`O,5?lO&;qQ`O,5?lOOQO-E=O-E=OO&<PQ`O1G6kO&<PQ`O1G6kO9kQ`O1G6kO@zQ`O<<LlOOQ[<<Ll<<LlO&<XQ`O<<LlO9uQ!0LrO<<LlO9kQ`O<<LlOOQ[<<LX<<LXO%:yQ!0MvO<<LXOOQ[<<LY<<LYO!E^Q`O<<LYO&<^QpO'#I|O&<iQ`O,5@|O!)[QlO,5@|OOQ[1G3W1G3WOOQO'#JO'#JOO9uQ!0LrO'#JOO&<qQpO,5=uOOQ[,5=u,5=uO&<xQpO'#EgO&=PQpO'#GeO&=UQ`O7+(zO&=ZQ`O7+(zOOQ[7+(z7+(zO!&zQMhO7+(zO%[QlO7+(zO&=cQ`O7+(zOOQ[7+(|7+(|O9uQ!0LrO7+(|O$%dQ`O7+(|O9`Q`O7+(|O!CUQpO7+(|O&=nQ`O,5?kOOQO-E<}-E<}OOQO'#H^'#H^O&=yQ`O1G6iO9uQ!0LrO<<GqOOQ[<<Gq<<GqO@zQ`O<<GqO&>RQ`O7+,WO&>WQ`O7+,XO%[QlO7+,WO%[QlO7+,XOOQ[7+)V7+)VO&>]Q`O7+)VO&>bQlO7+)VO&>iQ`O7+)VOOQ[<<Ly<<LyOOQ[<<L{<<L{OOQ[-E=Q-E=QOOQ[1G3z1G3zO&>nQ`O,5>aOOQ[,5>c,5>cO&>sQ`O1G4QO9eQ`O7+&fO!)[QlO7+&fOOQO7+%_7+%_O&>xQ?MtO1G6ZO?YQ`O7+%_OOQ!0Lf<<Ia<<IaOOQ!0Lf<<Iz<<IzO?YQ`O<<IzOOQO<<Is<<IsO$AlQ!0MxO<<IsO%[QlO<<IsOOQO<<Id<<IdO!ByQ!0LrO<<IdO&?SQ!0LrO<<IsO&?_Q!0MxO<= ^O&?oQ`O<= ]OOQO7+*_7+*_O9eQ`O7+*_OOQ[ANAkANAkO&?wQ!fOANAkO!&zQMhOANAkO#(ZQ`OANAkO4UQ!fOANAkO&@OQ`OANAkO%[QlOANAkO&@WQ!0MzO7+'zO&BiQ!0MzO,5?aO&DtQ!0MzO,5?cO&GPQ!0MzO7+'|O&IbQ!fO1G4lO&IlQ?MtO7+&aO&KpQ?MvO,5=XO&MwQ?MvO,5=ZO&NXQ?MvO,5=XO&NiQ?MvO,5=ZO&NyQ?MvO,59uO'#PQ?MvO,5<kO'%SQ?MvO,5<mO''hQ?MvO,5<{O')^Q?MtO7+'kO')kQ?MtO7+'mO')xQ`O,5<]OOQO7+'`7+'`OOQ!0Lh7+*d7+*dO')}QMjO<<K}OOQO1G4w1G4wO'*UQ`O1G4wO'*aQ`O1G4wO'*oQ`O7++|O'*oQ`O7++|O!&zQMhO1G4yO'*wQ!dO1G4yO'+RQ`O7++}O'+ZQ`O7+(VO'+fQ!dO7+(VOOQ!0Lb7+(T7+(TOOQ!0Lb7+(U7+(UO!CUQpO7+(TOCwQ`O7+(TO'+pQ`O7+(VO!&zQMhO7+(VO$+YQ`O7+(UO'+uQ`O7+(VOCwQ`O7+(UO'+}QMjO<<NwO!,TQMhO<<NwOOQ!0Lh7+$}7+$}O',XQ!dO,5?fOOQO-E<x-E<xO',cQ!0MvO7+(YO!&zQMhO7+(YOOQ[AN=gAN=gO9kQ`O1G5WOOQO1G5W1G5WO',sQ`O1G5WO',xQ`O7+,VO',xQ`O7+,VO9uQ!0LrOANBWO@zQ`OANBWOOQ[ANBWANBWO'-QQ`OANBWOOQ[ANAsANAsOOQ[ANAtANAtO'-VQ`O,5?hOOQO-E<z-E<zO'-bQ?MtO1G6hOOQO,5?j,5?jOOQO-E<|-E<|OOQ[1G3a1G3aO'-lQ`O,5=POOQ[<<Lf<<LfO!&zQMhO<<LfO&=UQ`O<<LfO'-qQ`O<<LfO%[QlO<<LfOOQ[<<Lh<<LhO9uQ!0LrO<<LhO$%dQ`O<<LhO9`Q`O<<LhO'-yQpO1G5VO'.UQ`O7+,TOOQ[AN=]AN=]O9uQ!0LrOAN=]OOQ[<= r<= rOOQ[<= s<= sO'.^Q`O<= rO'.cQ`O<= sOOQ[<<Lq<<LqO'.hQ`O<<LqO'.mQlO<<LqOOQ[1G3{1G3{O?YQ`O7+)lO'.tQ`O<<JQO'/PQ?MtO<<JQOOQO<<Hy<<HyOOQ!0LfAN?fAN?fOOQOAN?_AN?_O$AlQ!0MxOAN?_OOQOAN?OAN?OO%[QlOAN?_OOQO<<My<<MyOOQ[G27VG27VO!&zQMhOG27VO#(ZQ`OG27VO'/ZQ!fOG27VO4UQ!fOG27VO'/bQ`OG27VO'/jQ?MtO<<JfO'/wQ?MvO1G2`O'1mQ?MvO,5?aO'3pQ?MvO,5?cO'5sQ?MvO1G2sO'7vQ?MvO1G2uO'9yQ?MtO<<KXO':WQ?MtO<<I{OOQO1G1w1G1wO!,TQMhOANAiOOQO7+*c7+*cO':eQ`O7+*cO':pQ`O<= hO':xQ!dO7+*eOOQ!0Lb<<Kq<<KqO$+YQ`O<<KqOCwQ`O<<KqO';SQ`O<<KqO!&zQMhO<<KqOOQ!0Lb<<Ko<<KoO!CUQpO<<KoO';_Q!dO<<KqOOQ!0Lb<<Kp<<KpO';iQ`O<<KqO!&zQMhO<<KqO$+YQ`O<<KpO';nQMjOANDcO';xQ!0MvO<<KtOOQO7+*r7+*rO9kQ`O7+*rO'<YQ`O<= qOOQ[G27rG27rO9uQ!0LrOG27rO@zQ`OG27rO!)[QlO1G5SO'<bQ`O7+,SO'<jQ`O1G2kO&=UQ`OANBQOOQ[ANBQANBQO!&zQMhOANBQO'<oQ`OANBQOOQ[ANBSANBSO9uQ!0LrOANBSO$%dQ`OANBSOOQO'#H_'#H_OOQO7+*q7+*qOOQ[G22wG22wOOQ[ANE^ANE^OOQ[ANE_ANE_OOQ[ANB]ANB]O'<wQ`OANB]OOQ[<<MW<<MWO!)[QlOAN?lOOQOG24yG24yO$AlQ!0MxOG24yO#(ZQ`OLD,qOOQ[LD,qLD,qO!&zQMhOLD,qO'<|Q!fOLD,qO'=TQ?MvO7+'zO'>yQ?MvO,5?aO'@|Q?MvO,5?cO'CPQ?MvO7+'|O'DuQMjOG27TOOQO<<M}<<M}OOQ!0LbANA]ANA]O$+YQ`OANA]OCwQ`OANA]O'EVQ!dOANA]OOQ!0LbANAZANAZO'E^Q`OANA]O!&zQMhOANA]O'EiQ!dOANA]OOQ!0LbANA[ANA[OOQO<<N^<<N^OOQ[LD-^LD-^O9uQ!0LrOLD-^O'EsQ?MtO7+*nOOQO'#Gf'#GfOOQ[G27lG27lO&=UQ`OG27lO!&zQMhOG27lOOQ[G27nG27nO9uQ!0LrOG27nOOQ[G27wG27wO'E}Q?MtOG25WOOQOLD*eLD*eOOQ[!$(!]!$(!]O#(ZQ`O!$(!]O!&zQMhO!$(!]O'FXQ!0MzOG27TOOQ!0LbG26wG26wO$+YQ`OG26wO'HjQ`OG26wOCwQ`OG26wO'HuQ!dOG26wO!&zQMhOG26wOOQ[!$(!x!$(!xOOQ[LD-WLD-WO&=UQ`OLD-WOOQ[LD-YLD-YOOQ[!)9Ew!)9EwO#(ZQ`O!)9EwOOQ!0LbLD,cLD,cO$+YQ`OLD,cOCwQ`OLD,cO'H|Q`OLD,cO'IXQ!dOLD,cOOQ[!$(!r!$(!rOOQ[!.K;c!.K;cO'I`Q?MvOG27TOOQ!0Lb!$( }!$( }O$+YQ`O!$( }OCwQ`O!$( }O'KUQ`O!$( }OOQ!0Lb!)9Ei!)9EiO$+YQ`O!)9EiOCwQ`O!)9EiOOQ!0Lb!.K;T!.K;TO$+YQ`O!.K;TOOQ!0Lb!4/0o!4/0oO!)[QlO'#DzO1PQ`O'#EXO'KaQ!fO'#JrO'KhQ!L^O'#DvO'KoQlO'#EOO'KvQ!fO'#CiO'N^Q!fO'#CiO!)[QlO'#EQO'NnQlO,5;ZO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO,5;eO!)[QlO'#IpO(!qQ`O,5<iO!)[QlO,5;eO(!yQMhO,5;eO($dQMhO,5;eO!)[QlO,5;wO!&zQMhO'#GmO(!yQMhO'#GmO!&zQMhO'#GoO(!yQMhO'#GoO1SQ`O'#DZO1SQ`O'#DZO!&zQMhO'#GPO(!yQMhO'#GPO!&zQMhO'#GRO(!yQMhO'#GRO!&zQMhO'#GaO(!yQMhO'#GaO!)[QlO,5:jO($kQpO'#D_O($uQpO'#JvO!)[QlO,5@oO'NnQlO1G0uO(%PQ?MtO'#CiO!)[QlO1G2PO!&zQMhO'#IuO(!yQMhO'#IuO!&zQMhO'#IwO(!yQMhO'#IwO(%ZQ!dO'#CrO!&zQMhO,5<tO(!yQMhO,5<tO'NnQlO1G2RO!)[QlO7+&zO!&zQMhO1G2`O(!yQMhO1G2`O!&zQMhO'#IuO(!yQMhO'#IuO!&zQMhO'#IwO(!yQMhO'#IwO!&zQMhO1G2bO(!yQMhO1G2bO'NnQlO7+'mO'NnQlO7+&aO!&zQMhOANAiO(!yQMhOANAiO(%nQ`O'#EoO(%sQ`O'#EoO(%{Q`O'#F]O(&QQ`O'#EyO(&VQ`O'#KTO(&bQ`O'#KRO(&mQ`O,5;ZO(&rQMjO,5<eO(&yQ`O'#GYO('OQ`O'#GYO('TQ`O,5<eO(']Q`O,5<gO('eQ`O,5;ZO('mQ?MtO1G1`O('tQ`O,5<tO('yQ`O,5<tO((OQ`O,5<vO((TQ`O,5<vO((YQ`O1G2RO((_Q`O1G0uO((dQMjO<<K}O((kQMjO<<K}O((rQMhO'#F|O9`Q`O'#F{OAuQ`O'#EnO!)[QlO,5;tO!3oQ`O'#GYO!3oQ`O'#GYO!3oQ`O'#G[O!3oQ`O'#G[O!,TQMhO7+(cO!,TQMhO7+(cO%.zQ!dO1G2wO%.zQ!dO1G2wO!&zQMhO,5=]O!&zQMhO,5=]",
  stateData: "()x~O'|OS'}OSTOS(ORQ~OPYOQYOSfOY!VOaqOdzOeyOl!POpkOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!_XO!iuO!lZO!oYO!pYO!qYO!svO!uwO!xxO!|]O$W|O$niO%h}O%j!QO%l!OO%m!OO%n!OO%q!RO%s!SO%v!TO%w!TO%y!UO&W!WO&^!XO&`!YO&b!ZO&d![O&g!]O&m!^O&s!_O&u!`O&w!aO&y!bO&{!cO(TSO(VTO(YUO(aVO(o[O~OWtO~P`OPYOQYOSfOd!jOe!iOpkOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!_!eO!iuO!lZO!oYO!pYO!qYO!svO!u!gO!x!hO$W!kO$niO(T!dO(VTO(YUO(aVO(o[O~Oa!wOs!nO!S!oO!b!yO!c!vO!d!vO!|<VO#T!pO#U!pO#V!xO#W!pO#X!pO#[!zO#]!zO(U!lO(VTO(YUO(e!mO(o!sO~O(O!{O~OP]XR]X[]Xa]Xj]Xr]X!Q]X!S]X!]]X!l]X!p]X#R]X#S]X#`]X#kfX#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#v]X#x]X#z]X#{]X$Q]X'z]X(a]X(r]X(y]X(z]X~O!g%RX~P(qO_!}O(V#PO(W!}O(X#PO~O_#QO(X#PO(Y#PO(Z#QO~Ox#SO!U#TO(b#TO(c#VO~OPYOQYOSfOd!jOe!iOpkOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!_!eO!iuO!lZO!oYO!pYO!qYO!svO!u!gO!x!hO$W!kO$niO(T<ZO(VTO(YUO(aVO(o[O~O![#ZO!]#WO!Y(hP!Y(vP~P+}O!^#cO~P`OPYOQYOSfOd!jOe!iOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!_!eO!iuO!lZO!oYO!pYO!qYO!svO!u!gO!x!hO$W!kO$niO(VTO(YUO(aVO(o[O~Op#mO![#iO!|]O#i#lO#j#iO(T<[O!k(sP~P.iO!l#oO(T#nO~O!x#sO!|]O%h#tO~O#k#uO~O!g#vO#k#uO~OP$[OR#zO[$cOj$ROr$aO!Q#yO!S#{O!]$_O!l#xO!p$[O#R$RO#n$OO#o$PO#p$PO#q$PO#r$QO#s$RO#t$RO#u$bO#v$SO#x$UO#z$WO#{$XO(aVO(r$YO(y#|O(z#}O~Oa(fX'z(fX'w(fX!k(fX!Y(fX!_(fX%i(fX!g(fX~P1qO#S$dO#`$eO$Q$eOP(gXR(gX[(gXj(gXr(gX!Q(gX!S(gX!](gX!l(gX!p(gX#R(gX#n(gX#o(gX#p(gX#q(gX#r(gX#s(gX#t(gX#u(gX#v(gX#x(gX#z(gX#{(gX(a(gX(r(gX(y(gX(z(gX!_(gX%i(gX~Oa(gX'z(gX'w(gX!Y(gX!k(gXv(gX!g(gX~P4UO#`$eO~O$]$hO$_$gO$f$mO~OSfO!_$nO$i$oO$k$qO~Oh%VOj%dOk%dOp%WOr%XOs$tOt$tOz%YO|%ZO!O%]O!S${O!_$|O!i%bO!l$xO#j%cO$W%`O$t%^O$v%_O$y%aO(T$sO(VTO(YUO(a$uO(y$}O(z%POg(^P~Ol%[O~P7eO!l%eO~O!S%hO!_%iO(T%gO~O!g%mO~Oa%nO'z%nO~O!Q%rO~P%[O(U!lO~P%[O%n%vO~P%[Oh%VO!l%eO(T%gO(U!lO~Oe%}O!l%eO(T%gO~Oj$RO~O!_&PO(T%gO(U!lO(VTO(YUO`)WP~O!Q&SO!l&RO%j&VO&T&WO~P;SO!x#sO~O%s&YO!S)SX!_)SX(T)SX~O(T&ZO~Ol!PO!u&`O%j!QO%l!OO%m!OO%n!OO%q!RO%s!SO%v!TO%w!TO~Od&eOe&dO!x&bO%h&cO%{&aO~P<bOd&hOeyOl!PO!_&gO!u&`O!xxO!|]O%h}O%l!OO%m!OO%n!OO%q!RO%s!SO%v!TO%w!TO%y!UO~Ob&kO#`&nO%j&iO(U!lO~P=gO!l&oO!u&sO~O!l#oO~O!_XO~Oa%nO'x&{O'z%nO~Oa%nO'x'OO'z%nO~Oa%nO'x'QO'z%nO~O'w]X!Y]Xv]X!k]X&[]X!_]X%i]X!g]X~P(qO!b'_O!c'WO!d'WO(U!lO(VTO(YUO~Os'UO!S'TO!['XO(e'SO!^(iP!^(xP~P@nOn'bO!_'`O(T%gO~Oe'gO!l%eO(T%gO~O!Q&SO!l&RO~Os!nO!S!oO!|<VO#T!pO#U!pO#W!pO#X!pO(U!lO(VTO(YUO(e!mO(o!sO~O!b'mO!c'lO!d'lO#V!pO#['nO#]'nO~PBYOa%nOh%VO!g#vO!l%eO'z%nO(r'pO~O!p'tO#`'rO~PChOs!nO!S!oO(VTO(YUO(e!mO(o!sO~O!_XOs(mX!S(mX!b(mX!c(mX!d(mX!|(mX#T(mX#U(mX#V(mX#W(mX#X(mX#[(mX#](mX(U(mX(V(mX(Y(mX(e(mX(o(mX~O!c'lO!d'lO(U!lO~PDWO(P'xO(Q'xO(R'zO~O_!}O(V'|O(W!}O(X'|O~O_#QO(X'|O(Y'|O(Z#QO~Ov(OO~P%[Ox#SO!U#TO(b#TO(c(RO~O![(TO!Y'WX!Y'^X!]'WX!]'^X~P+}O!](VO!Y(hX~OP$[OR#zO[$cOj$ROr$aO!Q#yO!S#{O!](VO!l#xO!p$[O#R$RO#n$OO#o$PO#p$PO#q$PO#r$QO#s$RO#t$RO#u$bO#v$SO#x$UO#z$WO#{$XO(aVO(r$YO(y#|O(z#}O~O!Y(hX~PHRO!Y([O~O!Y(uX!](uX!g(uX!k(uX(r(uX~O#`(uX#k#dX!^(uX~PJUO#`(]O!Y(wX!](wX~O!](^O!Y(vX~O!Y(aO~O#`$eO~PJUO!^(bO~P`OR#zO!Q#yO!S#{O!l#xO(aVOP!na[!naj!nar!na!]!na!p!na#R!na#n!na#o!na#p!na#q!na#r!na#s!na#t!na#u!na#v!na#x!na#z!na#{!na(r!na(y!na(z!na~Oa!na'z!na'w!na!Y!na!k!nav!na!_!na%i!na!g!na~PKlO!k(cO~O!g#vO#`(dO(r'pO!](tXa(tX'z(tX~O!k(tX~PNXO!S%hO!_%iO!|]O#i(iO#j(hO(T%gO~O!](jO!k(sX~O!k(lO~O!S%hO!_%iO#j(hO(T%gO~OP(gXR(gX[(gXj(gXr(gX!Q(gX!S(gX!](gX!l(gX!p(gX#R(gX#n(gX#o(gX#p(gX#q(gX#r(gX#s(gX#t(gX#u(gX#v(gX#x(gX#z(gX#{(gX(a(gX(r(gX(y(gX(z(gX~O!g#vO!k(gX~P! uOR(nO!Q(mO!l#xO#S$dO!|!{a!S!{a~O!x!{a%h!{a!_!{a#i!{a#j!{a(T!{a~P!#vO!x(rO~OPYOQYOSfOd!jOe!iOpkOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!_XO!iuO!lZO!oYO!pYO!qYO!svO!u!gO!x!hO$W!kO$niO(T!dO(VTO(YUO(aVO(o[O~Oh%VOp%WOr%XOs$tOt$tOz%YO|%ZO!O<sO!S${O!_$|O!i>VO!l$xO#j<yO$W%`O$t<uO$v<wO$y%aO(T(vO(VTO(YUO(a$uO(y$}O(z%PO~O#k(xO~O![(zO!k(kP~P%[O(e(|O(o[O~O!S)OO!l#xO(e(|O(o[O~OP<UOQ<UOSfOd>ROe!iOpkOr<UOskOtkOzkO|<UO!O<UO!SWO!WkO!XkO!_!eO!i<XO!lZO!o<UO!p<UO!q<UO!s<YO!u<]O!x!hO$W!kO$n>PO(T)]O(VTO(YUO(aVO(o[O~O!]$_Oa$qa'z$qa'w$qa!k$qa!Y$qa!_$qa%i$qa!g$qa~Ol)dO~P!&zOh%VOp%WOr%XOs$tOt$tOz%YO|%ZO!O%]O!S${O!_$|O!i%bO!l$xO#j%cO$W%`O$t%^O$v%_O$y%aO(T(vO(VTO(YUO(a$uO(y$}O(z%PO~Og(pP~P!,TO!Q)iO!g)hO!_$^X$Z$^X$]$^X$_$^X$f$^X~O!g)hO!_({X$Z({X$]({X$_({X$f({X~O!Q)iO~P!.^O!Q)iO!_({X$Z({X$]({X$_({X$f({X~O!_)kO$Z)oO$])jO$_)jO$f)pO~O![)sO~P!)[O$]$hO$_$gO$f)wO~On$zX!Q$zX#S$zX'y$zX(y$zX(z$zX~OgmXg$zXnmX!]mX#`mX~P!0SOx)yO(b)zO(c)|O~On*VO!Q*OO'y*PO(y$}O(z%PO~Og)}O~P!1WOg*WO~Oh%VOr%XOs$tOt$tOz%YO|%ZO!O<sO!S*YO!_*ZO!i>VO!l$xO#j<yO$W%`O$t<uO$v<wO$y%aO(VTO(YUO(a$uO(y$}O(z%PO~Op*`O![*^O(T*XO!k)OP~P!1uO#k*aO~O!l*bO~Oh%VOp%WOr%XOs$tOt$tOz%YO|%ZO!O<sO!S${O!_$|O!i>VO!l$xO#j<yO$W%`O$t<uO$v<wO$y%aO(T*dO(VTO(YUO(a$uO(y$}O(z%PO~O![*gO!Y)PP~P!3tOr*sOs!nO!S*iO!b*qO!c*kO!d*kO!l*bO#[*rO%`*mO(U!lO(VTO(YUO(e!mO~O!^*pO~P!5iO#S$dOn(`X!Q(`X'y(`X(y(`X(z(`X!](`X#`(`X~Og(`X$O(`X~P!6kOn*xO#`*wOg(_X!](_X~O!]*yOg(^X~Oj%dOk%dOl%dO(T&ZOg(^P~Os*|O~Og)}O(T&ZO~O!l+SO~O(T(vO~Op+WO!S%hO![#iO!_%iO!|]O#i#lO#j#iO(T%gO!k(sP~O!g#vO#k+XO~O!S%hO![+ZO!](^O!_%iO(T%gO!Y(vP~Os'[O!S+]O![+[O(VTO(YUO(e(|O~O!^(xP~P!9|O!]+^Oa)TX'z)TX~OP$[OR#zO[$cOj$ROr$aO!Q#yO!S#{O!l#xO!p$[O#R$RO#n$OO#o$PO#p$PO#q$PO#r$QO#s$RO#t$RO#u$bO#v$SO#x$UO#z$WO#{$XO(aVO(r$YO(y#|O(z#}O~Oa!ja!]!ja'z!ja'w!ja!Y!ja!k!jav!ja!_!ja%i!ja!g!ja~P!:tOR#zO!Q#yO!S#{O!l#xO(aVOP!ra[!raj!rar!ra!]!ra!p!ra#R!ra#n!ra#o!ra#p!ra#q!ra#r!ra#s!ra#t!ra#u!ra#v!ra#x!ra#z!ra#{!ra(r!ra(y!ra(z!ra~Oa!ra'z!ra'w!ra!Y!ra!k!rav!ra!_!ra%i!ra!g!ra~P!=[OR#zO!Q#yO!S#{O!l#xO(aVOP!ta[!taj!tar!ta!]!ta!p!ta#R!ta#n!ta#o!ta#p!ta#q!ta#r!ta#s!ta#t!ta#u!ta#v!ta#x!ta#z!ta#{!ta(r!ta(y!ta(z!ta~Oa!ta'z!ta'w!ta!Y!ta!k!tav!ta!_!ta%i!ta!g!ta~P!?rOh%VOn+gO!_'`O%i+fO~O!g+iOa(]X!_(]X'z(]X!](]X~Oa%nO!_XO'z%nO~Oh%VO!l%eO~Oh%VO!l%eO(T%gO~O!g#vO#k(xO~Ob+tO%j+uO(T+qO(VTO(YUO!^)XP~O!]+vO`)WX~O[+zO~O`+{O~O!_&PO(T%gO(U!lO`)WP~O%j,OO~P;SOh%VO#`,SO~Oh%VOn,VO!_$|O~O!_,XO~O!Q,ZO!_XO~O%n%vO~O!x,`O~Oe,eO~Ob,fO(T#nO(VTO(YUO!^)VP~Oe%}O~O%j!QO(T&ZO~P=gO[,kO`,jO~OPYOQYOSfOdzOeyOpkOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!iuO!lZO!oYO!pYO!qYO!svO!xxO!|]O$niO%h}O(VTO(YUO(aVO(o[O~O!_!eO!u!gO$W!kO(T!dO~P!FyO`,jOa%nO'z%nO~OPYOQYOSfOd!jOe!iOpkOrYOskOtkOzkO|YO!OYO!SWO!WkO!XkO!_!eO!iuO!lZO!oYO!pYO!qYO!svO!x!hO$W!kO$niO(T!dO(VTO(YUO(aVO(o[O~Oa,pOl!OO!uwO%l!OO%m!OO%n!OO~P!IcO!l&oO~O&^,vO~O!_,xO~O&o,zO&q,{OP&laQ&laS&laY&laa&lad&lae&lal&lap&lar&las&lat&laz&la|&la!O&la!S&la!W&la!X&la!_&la!i&la!l&la!o&la!p&la!q&la!s&la!u&la!x&la!|&la$W&la$n&la%h&la%j&la%l&la%m&la%n&la%q&la%s&la%v&la%w&la%y&la&W&la&^&la&`&la&b&la&d&la&g&la&m&la&s&la&u&la&w&la&y&la&{&la'w&la(T&la(V&la(Y&la(a&la(o&la!^&la&e&lab&la&j&la~O(T-QO~Oh!eX!]!RX!^!RX!g!RX!g!eX!l!eX#`!RX~O!]!eX!^!eX~P#!iO!g-VO#`-UOh(jX!]#hX!^#hX!g(jX!l(jX~O!](jX!^(jX~P##[Oh%VO!g-XO!l%eO!]!aX!^!aX~Os!nO!S!oO(VTO(YUO(e!mO~OP<UOQ<UOSfOd>ROe!iOpkOr<UOskOtkOzkO|<UO!O<UO!SWO!WkO!XkO!_!eO!i<XO!lZO!o<UO!p<UO!q<UO!s<YO!u<]O!x!hO$W!kO$n>PO(VTO(YUO(aVO(o[O~O(T=QO~P#$qO!]-]O!^(iX~O!^-_O~O!g-VO#`-UO!]#hX!^#hX~O!]-`O!^(xX~O!^-bO~O!c-cO!d-cO(U!lO~P#$`O!^-fO~P'_On-iO!_'`O~O!Y-nO~Os!{a!b!{a!c!{a!d!{a#T!{a#U!{a#V!{a#W!{a#X!{a#[!{a#]!{a(U!{a(V!{a(Y!{a(e!{a(o!{a~P!#vO!p-sO#`-qO~PChO!c-uO!d-uO(U!lO~PDWOa%nO#`-qO'z%nO~Oa%nO!g#vO#`-qO'z%nO~Oa%nO!g#vO!p-sO#`-qO'z%nO(r'pO~O(P'xO(Q'xO(R-zO~Ov-{O~O!Y'Wa!]'Wa~P!:tO![.PO!Y'WX!]'WX~P%[O!](VO!Y(ha~O!Y(ha~PHRO!](^O!Y(va~O!S%hO![.TO!_%iO(T%gO!Y'^X!]'^X~O#`.VO!](ta!k(taa(ta'z(ta~O!g#vO~P#,wO!](jO!k(sa~O!S%hO!_%iO#j.ZO(T%gO~Op.`O!S%hO![.]O!_%iO!|]O#i._O#j.]O(T%gO!]'aX!k'aX~OR.dO!l#xO~Oh%VOn.gO!_'`O%i.fO~Oa#ci!]#ci'z#ci'w#ci!Y#ci!k#civ#ci!_#ci%i#ci!g#ci~P!:tOn>]O!Q*OO'y*PO(y$}O(z%PO~O#k#_aa#_a#`#_a'z#_a!]#_a!k#_a!_#_a!Y#_a~P#/sO#k(`XP(`XR(`X[(`Xa(`Xj(`Xr(`X!S(`X!l(`X!p(`X#R(`X#n(`X#o(`X#p(`X#q(`X#r(`X#s(`X#t(`X#u(`X#v(`X#x(`X#z(`X#{(`X'z(`X(a(`X(r(`X!k(`X!Y(`X'w(`Xv(`X!_(`X%i(`X!g(`X~P!6kO!].tO!k(kX~P!:tO!k.wO~O!Y.yO~OP$[OR#zO!Q#yO!S#{O!l#xO!p$[O(aVO[#mia#mij#mir#mi!]#mi#R#mi#o#mi#p#mi#q#mi#r#mi#s#mi#t#mi#u#mi#v#mi#x#mi#z#mi#{#mi'z#mi(r#mi(y#mi(z#mi'w#mi!Y#mi!k#miv#mi!_#mi%i#mi!g#mi~O#n#mi~P#3cO#n$OO~P#3cOP$[OR#zOr$aO!Q#yO!S#{O!l#xO!p$[O#n$OO#o$PO#p$PO#q$PO(aVO[#mia#mij#mi!]#mi#R#mi#s#mi#t#mi#u#mi#v#mi#x#mi#z#mi#{#mi'z#mi(r#mi(y#mi(z#mi'w#mi!Y#mi!k#miv#mi!_#mi%i#mi!g#mi~O#r#mi~P#6QO#r$QO~P#6QOP$[OR#zO[$cOj$ROr$aO!Q#yO!S#{O!l#xO!p$[O#R$RO#n$OO#o$PO#p$PO#q$PO#r$QO#s$RO#t$RO#u$bO(aVOa#mi!]#mi#x#mi#z#mi#{#mi'z#mi(r#mi(y#mi(z#mi'w#mi!Y#mi!k#miv#mi!_#mi%i#mi!g#mi~O#v#mi~P#8oOP$[OR#zO[$cOj$ROr$aO!Q#yO!S#{O!l#xO!p$[O#R$RO#n$OO#o$PO#p$PO#q$PO#r$QO#s$RO#t$RO#u$bO#v$SO(aVO(z#}Oa#mi!]#mi#z#mi#{#mi'z#mi(r#mi(y#mi'w#mi!Y#mi!k#miv#mi!_#mi%i#mi!g#mi~O#x$UO~P#;VO#x#mi~P#;VO#v$SO~P#8oOP$[OR#zO[$cOj$ROr$aO!Q#yO!S#{O!l#xO!p$[O#R$RO#n$OO#o$PO#p$PO#q$PO#r$QO#s$RO#t$RO#u$bO#v$SO#x$UO(aVO(y#|O(z#}Oa#mi!]#mi#{#mi'z#mi(r#mi'w#mi!Y#mi!k#miv#mi!_#mi%i#mi!g#mi~O#z#mi~P#={O#z$WO~P#={OP]XR]X[]Xj]Xr]X!Q]X!S]X!l]X!p]X#R]X#S]X#`]X#kfX#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#v]X#x]X#z]X#{]X$Q]X(a]X(r]X(y]X(z]X!]]X!^]X~O$O]X~P#@jOP$[OR#zO[<mOj<bOr<kO!Q#yO!S#{O!l#xO!p$[O#R<bO#n<_O#o<`O#p<`O#q<`O#r<aO#s<bO#t<bO#u<lO#v<cO#x<eO#z<gO#{<hO(aVO(r$YO(y#|O(z#}O~O$O.{O~P#BwO#S$dO#`<nO$Q<nO$O(gX!^(gX~P! uOa'da!]'da'z'da'w'da!k'da!Y'dav'da!_'da%i'da!g'da~P!:tO[#mia#mij#mir#mi!]#mi#R#mi#r#mi#s#mi#t#mi#u#mi#v#mi#x#mi#z#mi#{#mi'z#mi(r#mi'w#mi!Y#mi!k#miv#mi!_#mi%i#mi!g#mi~OP$[OR#zO!Q#yO!S#{O!l#xO!p$[O#n$OO#o$PO#p$PO#q$PO(aVO(y#mi(z#mi~P#EyOn>]O!Q*OO'y*PO(y$}O(z%POP#miR#mi!S#mi!l#mi!p#mi#n#mi#o#mi#p#mi#q#mi(a#mi~P#EyO!]/POg(pX~P!1WOg/RO~Oa$Pi!]$Pi'z$Pi'w$Pi!Y$Pi!k$Piv$Pi!_$Pi%i$Pi!g$Pi~P!:tO$]/SO$_/SO~O$]/TO$_/TO~O!g)hO#`/UO!_$cX$Z$cX$]$cX$_$cX$f$cX~O![/VO~O!_)kO$Z/XO$])jO$_)jO$f/YO~O!]<iO!^(fX~P#BwO!^/ZO~O!g)hO$f({X~O$f/]O~Ov/^O~P!&zOx)yO(b)zO(c/aO~O!S/dO~O(y$}On%aa!Q%aa'y%aa(z%aa!]%aa#`%aa~Og%aa$O%aa~P#L{O(z%POn%ca!Q%ca'y%ca(y%ca!]%ca#`%ca~Og%ca$O%ca~P#MnO!]fX!gfX!kfX!k$zX(rfX~P!0SOp%WO![/mO!](^O(T/lO!Y(vP!Y)PP~P!1uOr*sO!b*qO!c*kO!d*kO!l*bO#[*rO%`*mO(U!lO(VTO(YUO~Os<}O!S/nO![+[O!^*pO(e<|O!^(xP~P$ [O!k/oO~P#/sO!]/pO!g#vO(r'pO!k)OX~O!k/uO~OnoX!QoX'yoX(yoX(zoX~O!g#vO!koX~P$#OOp/wO!S%hO![*^O!_%iO(T%gO!k)OP~O#k/xO~O!Y$zX!]$zX!g%RX~P!0SO!]/yO!Y)PX~P#/sO!g/{O~O!Y/}O~OpkO(T0OO~P.iOh%VOr0TO!g#vO!l%eO(r'pO~O!g+iO~Oa%nO!]0XO'z%nO~O!^0ZO~P!5iO!c0[O!d0[O(U!lO~P#$`Os!nO!S0]O(VTO(YUO(e!mO~O#[0_O~Og%aa!]%aa#`%aa$O%aa~P!1WOg%ca!]%ca#`%ca$O%ca~P!1WOj%dOk%dOl%dO(T&ZOg'mX!]'mX~O!]*yOg(^a~Og0hO~On0jO#`0iOg(_a!](_a~OR0kO!Q0kO!S0lO#S$dOn}a'y}a(y}a(z}a!]}a#`}a~Og}a$O}a~P$(cO!Q*OO'y*POn$sa(y$sa(z$sa!]$sa#`$sa~Og$sa$O$sa~P$)_O!Q*OO'y*POn$ua(y$ua(z$ua!]$ua#`$ua~Og$ua$O$ua~P$*QO#k0oO~Og%Ta!]%Ta#`%Ta$O%Ta~P!1WO!g#vO~O#k0rO~O!]+^Oa)Ta'z)Ta~OR#zO!Q#yO!S#{O!l#xO(aVOP!ri[!rij!rir!ri!]!ri!p!ri#R!ri#n!ri#o!ri#p!ri#q!ri#r!ri#s!ri#t!ri#u!ri#v!ri#x!ri#z!ri#{!ri(r!ri(y!ri(z!ri~Oa!ri'z!ri'w!ri!Y!ri!k!riv!ri!_!ri%i!ri!g!ri~P$+oOh%VOr%XOs$tOt$tOz%YO|%ZO!O<sO!S${O!_$|O!i>VO!l$xO#j<yO$W%`O$t<uO$v<wO$y%aO(VTO(YUO(a$uO(y$}O(z%PO~Op0{O%]0|O(T0zO~P$.VO!g+iOa(]a!_(]a'z(]a!](]a~O#k1SO~O[]X!]fX!^fX~O!]1TO!^)XX~O!^1VO~O[1WO~Ob1YO(T+qO(VTO(YUO~O!_&PO(T%gO`'uX!]'uX~O!]+vO`)Wa~O!k1]O~P!:tO[1`O~O`1aO~O#`1fO~On1iO!_$|O~O(e(|O!^)UP~Oh%VOn1rO!_1oO%i1qO~O[1|O!]1zO!^)VX~O!^1}O~O`2POa%nO'z%nO~O(T#nO(VTO(YUO~O#S$dO#`$eO$Q$eOP(gXR(gX[(gXr(gX!Q(gX!S(gX!](gX!l(gX!p(gX#R(gX#n(gX#o(gX#p(gX#q(gX#r(gX#s(gX#t(gX#u(gX#v(gX#x(gX#z(gX#{(gX(a(gX(r(gX(y(gX(z(gX~Oj2SO&[2TOa(gX~P$3pOj2SO#`$eO&[2TO~Oa2VO~P%[Oa2XO~O&e2[OP&ciQ&ciS&ciY&cia&cid&cie&cil&cip&cir&cis&cit&ciz&ci|&ci!O&ci!S&ci!W&ci!X&ci!_&ci!i&ci!l&ci!o&ci!p&ci!q&ci!s&ci!u&ci!x&ci!|&ci$W&ci$n&ci%h&ci%j&ci%l&ci%m&ci%n&ci%q&ci%s&ci%v&ci%w&ci%y&ci&W&ci&^&ci&`&ci&b&ci&d&ci&g&ci&m&ci&s&ci&u&ci&w&ci&y&ci&{&ci'w&ci(T&ci(V&ci(Y&ci(a&ci(o&ci!^&cib&ci&j&ci~Ob2bO!^2`O&j2aO~P`O!_XO!l2dO~O&q,{OP&liQ&liS&liY&lia&lid&lie&lil&lip&lir&lis&lit&liz&li|&li!O&li!S&li!W&li!X&li!_&li!i&li!l&li!o&li!p&li!q&li!s&li!u&li!x&li!|&li$W&li$n&li%h&li%j&li%l&li%m&li%n&li%q&li%s&li%v&li%w&li%y&li&W&li&^&li&`&li&b&li&d&li&g&li&m&li&s&li&u&li&w&li&y&li&{&li'w&li(T&li(V&li(Y&li(a&li(o&li!^&li&e&lib&li&j&li~O!Y2jO~O!]!aa!^!aa~P#BwOs!nO!S!oO![2pO(e!mO!]'XX!^'XX~P@nO!]-]O!^(ia~O!]'_X!^'_X~P!9|O!]-`O!^(xa~O!^2wO~P'_Oa%nO#`3QO'z%nO~Oa%nO!g#vO#`3QO'z%nO~Oa%nO!g#vO!p3UO#`3QO'z%nO(r'pO~Oa%nO'z%nO~P!:tO!]$_Ov$qa~O!Y'Wi!]'Wi~P!:tO!](VO!Y(hi~O!](^O!Y(vi~O!Y(wi!](wi~P!:tO!](ti!k(tia(ti'z(ti~P!:tO#`3WO!](ti!k(tia(ti'z(ti~O!](jO!k(si~O!S%hO!_%iO!|]O#i3]O#j3[O(T%gO~O!S%hO!_%iO#j3[O(T%gO~On3dO!_'`O%i3cO~Oh%VOn3dO!_'`O%i3cO~O#k%aaP%aaR%aa[%aaa%aaj%aar%aa!S%aa!l%aa!p%aa#R%aa#n%aa#o%aa#p%aa#q%aa#r%aa#s%aa#t%aa#u%aa#v%aa#x%aa#z%aa#{%aa'z%aa(a%aa(r%aa!k%aa!Y%aa'w%aav%aa!_%aa%i%aa!g%aa~P#L{O#k%caP%caR%ca[%caa%caj%car%ca!S%ca!l%ca!p%ca#R%ca#n%ca#o%ca#p%ca#q%ca#r%ca#s%ca#t%ca#u%ca#v%ca#x%ca#z%ca#{%ca'z%ca(a%ca(r%ca!k%ca!Y%ca'w%cav%ca!_%ca%i%ca!g%ca~P#MnO#k%aaP%aaR%aa[%aaa%aaj%aar%aa!S%aa!]%aa!l%aa!p%aa#R%aa#n%aa#o%aa#p%aa#q%aa#r%aa#s%aa#t%aa#u%aa#v%aa#x%aa#z%aa#{%aa'z%aa(a%aa(r%aa!k%aa!Y%aa'w%aa#`%aav%aa!_%aa%i%aa!g%aa~P#/sO#k%caP%caR%ca[%caa%caj%car%ca!S%ca!]%ca!l%ca!p%ca#R%ca#n%ca#o%ca#p%ca#q%ca#r%ca#s%ca#t%ca#u%ca#v%ca#x%ca#z%ca#{%ca'z%ca(a%ca(r%ca!k%ca!Y%ca'w%ca#`%cav%ca!_%ca%i%ca!g%ca~P#/sO#k}aP}a[}aa}aj}ar}a!l}a!p}a#R}a#n}a#o}a#p}a#q}a#r}a#s}a#t}a#u}a#v}a#x}a#z}a#{}a'z}a(a}a(r}a!k}a!Y}a'w}av}a!_}a%i}a!g}a~P$(cO#k$saP$saR$sa[$saa$saj$sar$sa!S$sa!l$sa!p$sa#R$sa#n$sa#o$sa#p$sa#q$sa#r$sa#s$sa#t$sa#u$sa#v$sa#x$sa#z$sa#{$sa'z$sa(a$sa(r$sa!k$sa!Y$sa'w$sav$sa!_$sa%i$sa!g$sa~P$)_O#k$uaP$uaR$ua[$uaa$uaj$uar$ua!S$ua!l$ua!p$ua#R$ua#n$ua#o$ua#p$ua#q$ua#r$ua#s$ua#t$ua#u$ua#v$ua#x$ua#z$ua#{$ua'z$ua(a$ua(r$ua!k$ua!Y$ua'w$uav$ua!_$ua%i$ua!g$ua~P$*QO#k%TaP%TaR%Ta[%Taa%Taj%Tar%Ta!S%Ta!]%Ta!l%Ta!p%Ta#R%Ta#n%Ta#o%Ta#p%Ta#q%Ta#r%Ta#s%Ta#t%Ta#u%Ta#v%Ta#x%Ta#z%Ta#{%Ta'z%Ta(a%Ta(r%Ta!k%Ta!Y%Ta'w%Ta#`%Tav%Ta!_%Ta%i%Ta!g%Ta~P#/sOa#cq!]#cq'z#cq'w#cq!Y#cq!k#cqv#cq!_#cq%i#cq!g#cq~P!:tO![3lO!]'YX!k'YX~P%[O!].tO!k(ka~O!].tO!k(ka~P!:tO!Y3oO~O$O!na!^!na~PKlO$O!ja!]!ja!^!ja~P#BwO$O!ra!^!ra~P!=[O$O!ta!^!ta~P!?rOg']X!]']X~P!,TO!]/POg(pa~OSfO!_4TO$d4UO~O!^4YO~Ov4ZO~P#/sOa$mq!]$mq'z$mq'w$mq!Y$mq!k$mqv$mq!_$mq%i$mq!g$mq~P!:tO!Y4]O~P!&zO!S4^O~O!Q*OO'y*PO(z%POn'ia(y'ia!]'ia#`'ia~Og'ia$O'ia~P%-fO!Q*OO'y*POn'ka(y'ka(z'ka!]'ka#`'ka~Og'ka$O'ka~P%.XO(r$YO~P#/sO!YfX!Y$zX!]fX!]$zX!g%RX#`fX~P!0SOp%WO(T=WO~P!1uOp4bO!S%hO![4aO!_%iO(T%gO!]'eX!k'eX~O!]/pO!k)Oa~O!]/pO!g#vO!k)Oa~O!]/pO!g#vO(r'pO!k)Oa~Og$|i!]$|i#`$|i$O$|i~P!1WO![4jO!Y'gX!]'gX~P!3tO!]/yO!Y)Pa~O!]/yO!Y)Pa~P#/sOP]XR]X[]Xj]Xr]X!Q]X!S]X!Y]X!]]X!l]X!p]X#R]X#S]X#`]X#kfX#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#v]X#x]X#z]X#{]X$Q]X(a]X(r]X(y]X(z]X~Oj%YX!g%YX~P%2OOj4oO!g#vO~Oh%VO!g#vO!l%eO~Oh%VOr4tO!l%eO(r'pO~Or4yO!g#vO(r'pO~Os!nO!S4zO(VTO(YUO(e!mO~O(y$}On%ai!Q%ai'y%ai(z%ai!]%ai#`%ai~Og%ai$O%ai~P%5oO(z%POn%ci!Q%ci'y%ci(y%ci!]%ci#`%ci~Og%ci$O%ci~P%6bOg(_i!](_i~P!1WO#`5QOg(_i!](_i~P!1WO!k5VO~Oa$oq!]$oq'z$oq'w$oq!Y$oq!k$oqv$oq!_$oq%i$oq!g$oq~P!:tO!Y5ZO~O!]5[O!_)QX~P#/sOa$zX!_$zX%^]X'z$zX!]$zX~P!0SO%^5_OaoX!_oX'zoX!]oX~P$#OOp5`O(T#nO~O%^5_O~Ob5fO%j5gO(T+qO(VTO(YUO!]'tX!^'tX~O!]1TO!^)Xa~O[5kO~O`5lO~O[5pO~Oa%nO'z%nO~P#/sO!]5uO#`5wO!^)UX~O!^5xO~Or6OOs!nO!S*iO!b!yO!c!vO!d!vO!|<VO#T!pO#U!pO#V!pO#W!pO#X!pO#[5}O#]!zO(U!lO(VTO(YUO(e!mO(o!sO~O!^5|O~P%;eOn6TO!_1oO%i6SO~Oh%VOn6TO!_1oO%i6SO~Ob6[O(T#nO(VTO(YUO!]'sX!^'sX~O!]1zO!^)Va~O(VTO(YUO(e6^O~O`6bO~Oj6eO&[6fO~PNXO!k6gO~P%[Oa6iO~Oa6iO~P%[Ob2bO!^6nO&j2aO~P`O!g6pO~O!g6rOh(ji!](ji!^(ji!g(ji!l(jir(ji(r(ji~O!]#hi!^#hi~P#BwO#`6sO!]#hi!^#hi~O!]!ai!^!ai~P#BwOa%nO#`6|O'z%nO~Oa%nO!g#vO#`6|O'z%nO~O!](tq!k(tqa(tq'z(tq~P!:tO!](jO!k(sq~O!S%hO!_%iO#j7TO(T%gO~O!_'`O%i7WO~On7[O!_'`O%i7WO~O#k'iaP'iaR'ia['iaa'iaj'iar'ia!S'ia!l'ia!p'ia#R'ia#n'ia#o'ia#p'ia#q'ia#r'ia#s'ia#t'ia#u'ia#v'ia#x'ia#z'ia#{'ia'z'ia(a'ia(r'ia!k'ia!Y'ia'w'iav'ia!_'ia%i'ia!g'ia~P%-fO#k'kaP'kaR'ka['kaa'kaj'kar'ka!S'ka!l'ka!p'ka#R'ka#n'ka#o'ka#p'ka#q'ka#r'ka#s'ka#t'ka#u'ka#v'ka#x'ka#z'ka#{'ka'z'ka(a'ka(r'ka!k'ka!Y'ka'w'kav'ka!_'ka%i'ka!g'ka~P%.XO#k$|iP$|iR$|i[$|ia$|ij$|ir$|i!S$|i!]$|i!l$|i!p$|i#R$|i#n$|i#o$|i#p$|i#q$|i#r$|i#s$|i#t$|i#u$|i#v$|i#x$|i#z$|i#{$|i'z$|i(a$|i(r$|i!k$|i!Y$|i'w$|i#`$|iv$|i!_$|i%i$|i!g$|i~P#/sO#k%aiP%aiR%ai[%aia%aij%air%ai!S%ai!l%ai!p%ai#R%ai#n%ai#o%ai#p%ai#q%ai#r%ai#s%ai#t%ai#u%ai#v%ai#x%ai#z%ai#{%ai'z%ai(a%ai(r%ai!k%ai!Y%ai'w%aiv%ai!_%ai%i%ai!g%ai~P%5oO#k%ciP%ciR%ci[%cia%cij%cir%ci!S%ci!l%ci!p%ci#R%ci#n%ci#o%ci#p%ci#q%ci#r%ci#s%ci#t%ci#u%ci#v%ci#x%ci#z%ci#{%ci'z%ci(a%ci(r%ci!k%ci!Y%ci'w%civ%ci!_%ci%i%ci!g%ci~P%6bO!]'Ya!k'Ya~P!:tO!].tO!k(ki~O$O#ci!]#ci!^#ci~P#BwOP$[OR#zO!Q#yO!S#{O!l#xO!p$[O(aVO[#mij#mir#mi#R#mi#o#mi#p#mi#q#mi#r#mi#s#mi#t#mi#u#mi#v#mi#x#mi#z#mi#{#mi$O#mi(r#mi(y#mi(z#mi!]#mi!^#mi~O#n#mi~P%NdO#n<_O~P%NdOP$[OR#zOr<kO!Q#yO!S#{O!l#xO!p$[O#n<_O#o<`O#p<`O#q<`O(aVO[#mij#mi#R#mi#s#mi#t#mi#u#mi#v#mi#x#mi#z#mi#{#mi$O#mi(r#mi(y#mi(z#mi!]#mi!^#mi~O#r#mi~P&!lO#r<aO~P&!lOP$[OR#zO[<mOj<bOr<kO!Q#yO!S#{O!l#xO!p$[O#R<bO#n<_O#o<`O#p<`O#q<`O#r<aO#s<bO#t<bO#u<lO(aVO#x#mi#z#mi#{#mi$O#mi(r#mi(y#mi(z#mi!]#mi!^#mi~O#v#mi~P&$tOP$[OR#zO[<mOj<bOr<kO!Q#yO!S#{O!l#xO!p$[O#R<bO#n<_O#o<`O#p<`O#q<`O#r<aO#s<bO#t<bO#u<lO#v<cO(aVO(z#}O#z#mi#{#mi$O#mi(r#mi(y#mi!]#mi!^#mi~O#x<eO~P&&uO#x#mi~P&&uO#v<cO~P&$tOP$[OR#zO[<mOj<bOr<kO!Q#yO!S#{O!l#xO!p$[O#R<bO#n<_O#o<`O#p<`O#q<`O#r<aO#s<bO#t<bO#u<lO#v<cO#x<eO(aVO(y#|O(z#}O#{#mi$O#mi(r#mi!]#mi!^#mi~O#z#mi~P&)UO#z<gO~P&)UOa#|y!]#|y'z#|y'w#|y!Y#|y!k#|yv#|y!_#|y%i#|y!g#|y~P!:tO[#mij#mir#mi#R#mi#r#mi#s#mi#t#mi#u#mi#v#mi#x#mi#z#mi#{#mi$O#mi(r#mi!]#mi!^#mi~OP$[OR#zO!Q#yO!S#{O!l#xO!p$[O#n<_O#o<`O#p<`O#q<`O(aVO(y#mi(z#mi~P&,QOn>^O!Q*OO'y*PO(y$}O(z%POP#miR#mi!S#mi!l#mi!p#mi#n#mi#o#mi#p#mi#q#mi(a#mi~P&,QO#S$dOP(`XR(`X[(`Xj(`Xn(`Xr(`X!Q(`X!S(`X!l(`X!p(`X#R(`X#n(`X#o(`X#p(`X#q(`X#r(`X#s(`X#t(`X#u(`X#v(`X#x(`X#z(`X#{(`X$O(`X'y(`X(a(`X(r(`X(y(`X(z(`X!](`X!^(`X~O$O$Pi!]$Pi!^$Pi~P#BwO$O!ri!^!ri~P$+oOg']a!]']a~P!1WO!^7nO~O!]'da!^'da~P#BwO!Y7oO~P#/sO!g#vO(r'pO!]'ea!k'ea~O!]/pO!k)Oi~O!]/pO!g#vO!k)Oi~Og$|q!]$|q#`$|q$O$|q~P!1WO!Y'ga!]'ga~P#/sO!g7vO~O!]/yO!Y)Pi~P#/sO!]/yO!Y)Pi~O!Y7yO~Oh%VOr8OO!l%eO(r'pO~Oj8QO!g#vO~Or8TO!g#vO(r'pO~O!Q*OO'y*PO(z%POn'ja(y'ja!]'ja#`'ja~Og'ja$O'ja~P&5RO!Q*OO'y*POn'la(y'la(z'la!]'la#`'la~Og'la$O'la~P&5tOg(_q!](_q~P!1WO#`8VOg(_q!](_q~P!1WO!Y8WO~Og%Oq!]%Oq#`%Oq$O%Oq~P!1WOa$oy!]$oy'z$oy'w$oy!Y$oy!k$oyv$oy!_$oy%i$oy!g$oy~P!:tO!g6rO~O!]5[O!_)Qa~O!_'`OP$TaR$Ta[$Taj$Tar$Ta!Q$Ta!S$Ta!]$Ta!l$Ta!p$Ta#R$Ta#n$Ta#o$Ta#p$Ta#q$Ta#r$Ta#s$Ta#t$Ta#u$Ta#v$Ta#x$Ta#z$Ta#{$Ta(a$Ta(r$Ta(y$Ta(z$Ta~O%i7WO~P&8fO%^8[Oa%[i!_%[i'z%[i!]%[i~Oa#cy!]#cy'z#cy'w#cy!Y#cy!k#cyv#cy!_#cy%i#cy!g#cy~P!:tO[8^O~Ob8`O(T+qO(VTO(YUO~O!]1TO!^)Xi~O`8dO~O(e(|O!]'pX!^'pX~O!]5uO!^)Ua~O!^8nO~P%;eO(o!sO~P$&YO#[8oO~O!_1oO~O!_1oO%i8qO~On8tO!_1oO%i8qO~O[8yO!]'sa!^'sa~O!]1zO!^)Vi~O!k8}O~O!k9OO~O!k9RO~O!k9RO~P%[Oa9TO~O!g9UO~O!k9VO~O!](wi!^(wi~P#BwOa%nO#`9_O'z%nO~O!](ty!k(tya(ty'z(ty~P!:tO!](jO!k(sy~O%i9bO~P&8fO!_'`O%i9bO~O#k$|qP$|qR$|q[$|qa$|qj$|qr$|q!S$|q!]$|q!l$|q!p$|q#R$|q#n$|q#o$|q#p$|q#q$|q#r$|q#s$|q#t$|q#u$|q#v$|q#x$|q#z$|q#{$|q'z$|q(a$|q(r$|q!k$|q!Y$|q'w$|q#`$|qv$|q!_$|q%i$|q!g$|q~P#/sO#k'jaP'jaR'ja['jaa'jaj'jar'ja!S'ja!l'ja!p'ja#R'ja#n'ja#o'ja#p'ja#q'ja#r'ja#s'ja#t'ja#u'ja#v'ja#x'ja#z'ja#{'ja'z'ja(a'ja(r'ja!k'ja!Y'ja'w'jav'ja!_'ja%i'ja!g'ja~P&5RO#k'laP'laR'la['laa'laj'lar'la!S'la!l'la!p'la#R'la#n'la#o'la#p'la#q'la#r'la#s'la#t'la#u'la#v'la#x'la#z'la#{'la'z'la(a'la(r'la!k'la!Y'la'w'lav'la!_'la%i'la!g'la~P&5tO#k%OqP%OqR%Oq[%Oqa%Oqj%Oqr%Oq!S%Oq!]%Oq!l%Oq!p%Oq#R%Oq#n%Oq#o%Oq#p%Oq#q%Oq#r%Oq#s%Oq#t%Oq#u%Oq#v%Oq#x%Oq#z%Oq#{%Oq'z%Oq(a%Oq(r%Oq!k%Oq!Y%Oq'w%Oq#`%Oqv%Oq!_%Oq%i%Oq!g%Oq~P#/sO!]'Yi!k'Yi~P!:tO$O#cq!]#cq!^#cq~P#BwO(y$}OP%aaR%aa[%aaj%aar%aa!S%aa!l%aa!p%aa#R%aa#n%aa#o%aa#p%aa#q%aa#r%aa#s%aa#t%aa#u%aa#v%aa#x%aa#z%aa#{%aa$O%aa(a%aa(r%aa!]%aa!^%aa~On%aa!Q%aa'y%aa(z%aa~P&IyO(z%POP%caR%ca[%caj%car%ca!S%ca!l%ca!p%ca#R%ca#n%ca#o%ca#p%ca#q%ca#r%ca#s%ca#t%ca#u%ca#v%ca#x%ca#z%ca#{%ca$O%ca(a%ca(r%ca!]%ca!^%ca~On%ca!Q%ca'y%ca(y%ca~P&LQOn>^O!Q*OO'y*PO(z%PO~P&IyOn>^O!Q*OO'y*PO(y$}O~P&LQOR0kO!Q0kO!S0lO#S$dOP}a[}aj}an}ar}a!l}a!p}a#R}a#n}a#o}a#p}a#q}a#r}a#s}a#t}a#u}a#v}a#x}a#z}a#{}a$O}a'y}a(a}a(r}a(y}a(z}a!]}a!^}a~O!Q*OO'y*POP$saR$sa[$saj$san$sar$sa!S$sa!l$sa!p$sa#R$sa#n$sa#o$sa#p$sa#q$sa#r$sa#s$sa#t$sa#u$sa#v$sa#x$sa#z$sa#{$sa$O$sa(a$sa(r$sa(y$sa(z$sa!]$sa!^$sa~O!Q*OO'y*POP$uaR$ua[$uaj$uan$uar$ua!S$ua!l$ua!p$ua#R$ua#n$ua#o$ua#p$ua#q$ua#r$ua#s$ua#t$ua#u$ua#v$ua#x$ua#z$ua#{$ua$O$ua(a$ua(r$ua(y$ua(z$ua!]$ua!^$ua~On>^O!Q*OO'y*PO(y$}O(z%PO~OP%TaR%Ta[%Taj%Tar%Ta!S%Ta!l%Ta!p%Ta#R%Ta#n%Ta#o%Ta#p%Ta#q%Ta#r%Ta#s%Ta#t%Ta#u%Ta#v%Ta#x%Ta#z%Ta#{%Ta$O%Ta(a%Ta(r%Ta!]%Ta!^%Ta~P''VO$O$mq!]$mq!^$mq~P#BwO$O$oq!]$oq!^$oq~P#BwO!^9oO~O$O9pO~P!1WO!g#vO!]'ei!k'ei~O!g#vO(r'pO!]'ei!k'ei~O!]/pO!k)Oq~O!Y'gi!]'gi~P#/sO!]/yO!Y)Pq~Or9wO!g#vO(r'pO~O[9yO!Y9xO~P#/sO!Y9xO~Oj:PO!g#vO~Og(_y!](_y~P!1WO!]'na!_'na~P#/sOa%[q!_%[q'z%[q!]%[q~P#/sO[:UO~O!]1TO!^)Xq~O`:YO~O#`:ZO!]'pa!^'pa~O!]5uO!^)Ui~P#BwO!S:]O~O!_1oO%i:`O~O(VTO(YUO(e:eO~O!]1zO!^)Vq~O!k:hO~O!k:iO~O!k:jO~O!k:jO~P%[O#`:mO!]#hy!^#hy~O!]#hy!^#hy~P#BwO%i:rO~P&8fO!_'`O%i:rO~O$O#|y!]#|y!^#|y~P#BwOP$|iR$|i[$|ij$|ir$|i!S$|i!l$|i!p$|i#R$|i#n$|i#o$|i#p$|i#q$|i#r$|i#s$|i#t$|i#u$|i#v$|i#x$|i#z$|i#{$|i$O$|i(a$|i(r$|i!]$|i!^$|i~P''VO!Q*OO'y*PO(z%POP'iaR'ia['iaj'ian'iar'ia!S'ia!l'ia!p'ia#R'ia#n'ia#o'ia#p'ia#q'ia#r'ia#s'ia#t'ia#u'ia#v'ia#x'ia#z'ia#{'ia$O'ia(a'ia(r'ia(y'ia!]'ia!^'ia~O!Q*OO'y*POP'kaR'ka['kaj'kan'kar'ka!S'ka!l'ka!p'ka#R'ka#n'ka#o'ka#p'ka#q'ka#r'ka#s'ka#t'ka#u'ka#v'ka#x'ka#z'ka#{'ka$O'ka(a'ka(r'ka(y'ka(z'ka!]'ka!^'ka~O(y$}OP%aiR%ai[%aij%ain%air%ai!Q%ai!S%ai!l%ai!p%ai#R%ai#n%ai#o%ai#p%ai#q%ai#r%ai#s%ai#t%ai#u%ai#v%ai#x%ai#z%ai#{%ai$O%ai'y%ai(a%ai(r%ai(z%ai!]%ai!^%ai~O(z%POP%ciR%ci[%cij%cin%cir%ci!Q%ci!S%ci!l%ci!p%ci#R%ci#n%ci#o%ci#p%ci#q%ci#r%ci#s%ci#t%ci#u%ci#v%ci#x%ci#z%ci#{%ci$O%ci'y%ci(a%ci(r%ci(y%ci!]%ci!^%ci~O$O$oy!]$oy!^$oy~P#BwO$O#cy!]#cy!^#cy~P#BwO!g#vO!]'eq!k'eq~O!]/pO!k)Oy~O!Y'gq!]'gq~P#/sOr:|O!g#vO(r'pO~O[;QO!Y;PO~P#/sO!Y;PO~Og(_!R!](_!R~P!1WOa%[y!_%[y'z%[y!]%[y~P#/sO!]1TO!^)Xy~O!]5uO!^)Uq~O(T;XO~O!_1oO%i;[O~O!k;_O~O%i;dO~P&8fOP$|qR$|q[$|qj$|qr$|q!S$|q!l$|q!p$|q#R$|q#n$|q#o$|q#p$|q#q$|q#r$|q#s$|q#t$|q#u$|q#v$|q#x$|q#z$|q#{$|q$O$|q(a$|q(r$|q!]$|q!^$|q~P''VO!Q*OO'y*PO(z%POP'jaR'ja['jaj'jan'jar'ja!S'ja!l'ja!p'ja#R'ja#n'ja#o'ja#p'ja#q'ja#r'ja#s'ja#t'ja#u'ja#v'ja#x'ja#z'ja#{'ja$O'ja(a'ja(r'ja(y'ja!]'ja!^'ja~O!Q*OO'y*POP'laR'la['laj'lan'lar'la!S'la!l'la!p'la#R'la#n'la#o'la#p'la#q'la#r'la#s'la#t'la#u'la#v'la#x'la#z'la#{'la$O'la(a'la(r'la(y'la(z'la!]'la!^'la~OP%OqR%Oq[%Oqj%Oqr%Oq!S%Oq!l%Oq!p%Oq#R%Oq#n%Oq#o%Oq#p%Oq#q%Oq#r%Oq#s%Oq#t%Oq#u%Oq#v%Oq#x%Oq#z%Oq#{%Oq$O%Oq(a%Oq(r%Oq!]%Oq!^%Oq~P''VOg%e!Z!]%e!Z#`%e!Z$O%e!Z~P!1WO!Y;hO~P#/sOr;iO!g#vO(r'pO~O[;kO!Y;hO~P#/sO!]'pq!^'pq~P#BwO!]#h!Z!^#h!Z~P#BwO#k%e!ZP%e!ZR%e!Z[%e!Za%e!Zj%e!Zr%e!Z!S%e!Z!]%e!Z!l%e!Z!p%e!Z#R%e!Z#n%e!Z#o%e!Z#p%e!Z#q%e!Z#r%e!Z#s%e!Z#t%e!Z#u%e!Z#v%e!Z#x%e!Z#z%e!Z#{%e!Z'z%e!Z(a%e!Z(r%e!Z!k%e!Z!Y%e!Z'w%e!Z#`%e!Zv%e!Z!_%e!Z%i%e!Z!g%e!Z~P#/sOr;tO!g#vO(r'pO~O!Y;uO~P#/sOr;|O!g#vO(r'pO~O!Y;}O~P#/sOP%e!ZR%e!Z[%e!Zj%e!Zr%e!Z!S%e!Z!l%e!Z!p%e!Z#R%e!Z#n%e!Z#o%e!Z#p%e!Z#q%e!Z#r%e!Z#s%e!Z#t%e!Z#u%e!Z#v%e!Z#x%e!Z#z%e!Z#{%e!Z$O%e!Z(a%e!Z(r%e!Z!]%e!Z!^%e!Z~P''VOr<QO!g#vO(r'pO~Ov(fX~P1qO!Q%rO~P!)[O(U!lO~P!)[O!YfX!]fX#`fX~P%2OOP]XR]X[]Xj]Xr]X!Q]X!S]X!]]X!]fX!l]X!p]X#R]X#S]X#`]X#`fX#kfX#n]X#o]X#p]X#q]X#r]X#s]X#t]X#u]X#v]X#x]X#z]X#{]X$Q]X(a]X(r]X(y]X(z]X~O!gfX!k]X!kfX(rfX~P'LTOP<UOQ<UOSfOd>ROe!iOpkOr<UOskOtkOzkO|<UO!O<UO!SWO!WkO!XkO!_XO!i<XO!lZO!o<UO!p<UO!q<UO!s<YO!u<]O!x!hO$W!kO$n>PO(T)]O(VTO(YUO(aVO(o[O~O!]<iO!^$qa~Oh%VOp%WOr%XOs$tOt$tOz%YO|%ZO!O<tO!S${O!_$|O!i>WO!l$xO#j<zO$W%`O$t<vO$v<xO$y%aO(T(vO(VTO(YUO(a$uO(y$}O(z%PO~Ol)dO~P(!yOr!eX(r!eX~P#!iOr(jX(r(jX~P##[O!^]X!^fX~P'LTO!YfX!Y$zX!]fX!]$zX#`fX~P!0SO#k<^O~O!g#vO#k<^O~O#`<nO~Oj<bO~O#`=OO!](wX!^(wX~O#`<nO!](uX!^(uX~O#k=PO~Og=RO~P!1WO#k=XO~O#k=YO~Og=RO(T&ZO~O!g#vO#k=ZO~O!g#vO#k=PO~O$O=[O~P#BwO#k=]O~O#k=^O~O#k=cO~O#k=dO~O#k=eO~O#k=fO~O$O=gO~P!1WO$O=hO~P!1WOl=sO~P7eOk#S#T#U#W#X#[#i#j#u$n$t$v$y%]%^%h%i%j%q%s%v%w%y%{~(OT#o!X'|(U#ps#n#qr!Q'}$]'}(T$_(e~",
  goto: "$9Y)]PPPPPP)^PP)aP)rP+W/]PPPP6mPP7TPP=QPPP@tPA^PA^PPPA^PCfPA^PA^PA^PCjPCoPD^PIWPPPI[PPPPI[L_PPPLeMVPI[PI[PP! eI[PPPI[PI[P!#lI[P!'S!(X!(bP!)U!)Y!)U!,gPPPPPPP!-W!(XPP!-h!/YP!2iI[I[!2n!5z!:h!:h!>gPPP!>oI[PPPPPPPPP!BOP!C]PPI[!DnPI[PI[I[I[I[I[PI[!FQP!I[P!LbP!Lf!Lp!Lt!LtP!IXP!Lx!LxP#!OP#!SI[PI[#!Y#%_CjA^PA^PA^A^P#&lA^A^#)OA^#+vA^#.SA^A^#.r#1W#1W#1]#1f#1W#1qPP#1WPA^#2ZA^#6YA^A^6mPPP#:_PPP#:x#:xP#:xP#;`#:xPP#;fP#;]P#;]#;y#;]#<e#<k#<n)aP#<q)aP#<z#<z#<zP)aP)aP)aP)aPP)aP#=Q#=TP#=T)aP#=XP#=[P)aP)aP)aP)aP)aP)a)aPP#=b#=h#=s#=y#>P#>V#>]#>k#>q#>{#?R#?]#?c#?s#?y#@k#@}#AT#AZ#Ai#BO#Cs#DR#DY#Et#FS#Gt#HS#HY#H`#Hf#Hp#Hv#H|#IW#Ij#IpPPPPPPPPPPP#IvPPPPPPP#Jk#Mx$ b$ i$ qPPP$']P$'f$*_$0x$0{$1O$1}$2Q$2X$2aP$2g$2jP$3W$3[$4S$5b$5g$5}PP$6S$6Y$6^$6a$6e$6i$7e$7|$8e$8i$8l$8o$8y$8|$9Q$9UR!|RoqOXst!Z#d%m&r&t&u&w,s,x2[2_Y!vQ'`-e1o5{Q%tvQ%|yQ&T|Q&j!VS'W!e-]Q'f!iS'l!r!yU*k$|*Z*oQ+o%}S+|&V&WQ,d&dQ-c'_Q-m'gQ-u'mQ0[*qQ1b,OQ1y,eR<{<Y%SdOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&r&t&u&w&{'T'b'r(T(V(](d(x(z)O)}*i+X+],p,s,x-i-q.P.V.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3l4z6T6e6f6i6|8t9T9_S#q]<V!r)_$Z$n'X)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SU+P%]<s<tQ+t&PQ,f&gQ,m&oQ0x+gQ0}+iQ1Y+uQ2R,kQ3`.gQ5`0|Q5f1TQ6[1zQ7Y3dQ8`5gR9e7['QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>S!S!nQ!r!v!y!z$|'W'_'`'l'm'n*k*o*q*r-]-c-e-u0[0_1o5{5}%[$ti#v$b$c$d$x${%O%Q%^%_%c)y*R*T*V*Y*a*g*w*x+f+i,S,V.f/P/d/m/x/y/{0`0b0i0j0o1f1i1q3c4^4_4j4o5Q5[5_6S7W7v8Q8V8[8q9b9p9y:P:`:r;Q;[;d;k<l<m<o<p<q<r<u<v<w<x<y<z=S=T=U=V=X=Y=]=^=_=`=a=b=c=d=g=h>P>X>Y>]>^Q&X|Q'U!eS'[%i-`Q+t&PQ,P&WQ,f&gQ0n+SQ1Y+uQ1_+{Q2Q,jQ2R,kQ5f1TQ5o1aQ6[1zQ6_1|Q6`2PQ8`5gQ8c5lQ8|6bQ:X8dQ:f8yQ;V:YR<}*ZrnOXst!V!Z#d%m&i&r&t&u&w,s,x2[2_R,h&k&z^OPXYstuvwz!Z!`!g!j!o#S#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%m%t&R&k&n&o&r&t&u&w&{'T'b'r(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>R>S[#]WZ#W#Z'X(T!b%jm#h#i#l$x%e%h(^(h(i(j*Y*^*b+Z+[+^,o-V.T.Z.[.]._/m/p2d3[3]4a6r7TQ%wxQ%{yW&Q|&V&W,OQ&_!TQ'c!hQ'e!iQ(q#sS+n%|%}Q+r&PQ,_&bQ,c&dS-l'f'gQ.i(rQ1R+oQ1X+uQ1Z+vQ1^+zQ1t,`S1x,d,eQ2|-mQ5e1TQ5i1WQ5n1`Q6Z1yQ8_5gQ8b5kQ8f5pQ:T8^R;T:U!U$zi$d%O%Q%^%_%c*R*T*a*w*x/P/x0`0b0i0j0o4_5Q8V9p>P>X>Y!^%yy!i!u%{%|%}'V'e'f'g'k'u*j+n+o-Y-l-m-t0R0U1R2u2|3T4r4s4v7}9{Q+h%wQ,T&[Q,W&]Q,b&dQ.h(qQ1s,_U1w,c,d,eQ3e.iQ6U1tS6Y1x1yQ8x6Z#f>T#v$b$c$x${)y*V*Y*g+f+i,S,V.f/d/m/y/{1f1i1q3c4^4j4o5[5_6S7W7v8Q8[8q9b9y:P:`:r;Q;[;d;k<o<q<u<w<y=S=U=X=]=_=a=c=g>]>^o>U<l<m<p<r<v<x<z=T=V=Y=^=`=b=d=hW%Ti%V*y>PS&[!Q&iQ&]!RQ&^!SU*}%[%d=sR,R&Y%]%Si#v$b$c$d$x${%O%Q%^%_%c)y*R*T*V*Y*a*g*w*x+f+i,S,V.f/P/d/m/x/y/{0`0b0i0j0o1f1i1q3c4^4_4j4o5Q5[5_6S7W7v8Q8V8[8q9b9p9y:P:`:r;Q;[;d;k<l<m<o<p<q<r<u<v<w<x<y<z=S=T=U=V=X=Y=]=^=_=`=a=b=c=d=g=h>P>X>Y>]>^T)z$u){V+P%]<s<tW'[!e%i*Z-`S(}#y#zQ+c%rQ+y&SS.b(m(nQ1j,XQ5T0kR8i5u'QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>S$i$^c#Y#e%q%s%u(S(Y(t(y)R)S)T)U)V)W)X)Y)Z)[)^)`)b)g)q+d+x-Z-x-}.S.U.s.v.z.|.}/O/b0p2k2n3O3V3k3p3q3r3s3t3u3v3w3x3y3z3{3|4P4Q4X5X5c6u6{7Q7a7b7k7l8k9X9]9g9m9n:o;W;`<W=vT#TV#U'RkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SQ'Y!eR2q-]!W!nQ!e!r!v!y!z$|'W'_'`'l'm'n*Z*k*o*q*r-]-c-e-u0[0_1o5{5}R1l,ZnqOXst!Z#d%m&r&t&u&w,s,x2[2_Q&y!^Q'v!xS(s#u<^Q+l%zQ,]&_Q,^&aQ-j'dQ-w'oS.r(x=PS0q+X=ZQ1P+mQ1n,[Q2c,zQ2e,{Q2m-WQ2z-kQ2}-oS5Y0r=eQ5a1QS5d1S=fQ6t2oQ6x2{Q6}3SQ8]5bQ9Y6vQ9Z6yQ9^7OR:l9V$d$]c#Y#e%s%u(S(Y(t(y)R)S)T)U)V)W)X)Y)Z)[)^)`)b)g)q+d+x-Z-x-}.S.U.s.v.z.}/O/b0p2k2n3O3V3k3p3q3r3s3t3u3v3w3x3y3z3{3|4P4Q4X5X5c6u6{7Q7a7b7k7l8k9X9]9g9m9n:o;W;`<W=vS(o#p'iQ)P#zS+b%q.|S.c(n(pR3^.d'QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SS#q]<VQ&t!XQ&u!YQ&w![Q&x!]R2Z,vQ'a!hQ+e%wQ-h'cS.e(q+hQ2x-gW3b.h.i0w0yQ6w2yW7U3_3a3e5^U9a7V7X7ZU:q9c9d9fS;b:p:sQ;p;cR;x;qU!wQ'`-eT5y1o5{!Q_OXZ`st!V!Z#d#h%e%m&i&k&r&t&u&w(j,s,x.[2[2_]!pQ!r'`-e1o5{T#q]<V%^{OPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&o&r&t&u&w&{'T'b'r(T(V(](d(x(z)O)}*i+X+]+g,p,s,x-i-q.P.V.g.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3d3l4z6T6e6f6i6|7[8t9T9_S(}#y#zS.b(m(n!s=l$Z$n'X)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SU$fd)_,mS(p#p'iU*v%R(w4OU0m+O.n7gQ5^0xQ7V3`Q9d7YR:s9em!tQ!r!v!y!z'`'l'm'n-e-u1o5{5}Q't!uS(f#g2US-s'k'wQ/s*]Q0R*jQ3U-vQ4f/tQ4r0TQ4s0UQ4x0^Q7r4`S7}4t4vS8R4y4{Q9r7sQ9v7yQ9{8OQ:Q8TS:{9w9xS;g:|;PS;s;h;iS;{;t;uS<P;|;}R<S<QQ#wbQ's!uS(e#g2US(g#m+WQ+Y%fQ+j%xQ+p&OU-r'k't'wQ.W(fU/r*]*`/wQ0S*jQ0V*lQ1O+kQ1u,aS3R-s-vQ3Z.`S4e/s/tQ4n0PS4q0R0^Q4u0WQ6W1vQ7P3US7q4`4bQ7u4fU7|4r4x4{Q8P4wQ8v6XS9q7r7sQ9u7yQ9}8RQ:O8SQ:c8wQ:y9rS:z9v9xQ;S:QQ;^:dS;f:{;PS;r;g;hS;z;s;uS<O;{;}Q<R<PQ<T<SQ=o=jQ={=tR=|=uV!wQ'`-e%^aOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&o&r&t&u&w&{'T'b'r(T(V(](d(x(z)O)}*i+X+]+g,p,s,x-i-q.P.V.g.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3d3l4z6T6e6f6i6|7[8t9T9_S#wz!j!r=i$Z$n'X)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SR=o>R%^bOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&o&r&t&u&w&{'T'b'r(T(V(](d(x(z)O)}*i+X+]+g,p,s,x-i-q.P.V.g.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3d3l4z6T6e6f6i6|7[8t9T9_Q%fj!^%xy!i!u%{%|%}'V'e'f'g'k'u*j+n+o-Y-l-m-t0R0U1R2u2|3T4r4s4v7}9{S&Oz!jQ+k%yQ,a&dW1v,b,c,d,eU6X1w1x1yS8w6Y6ZQ:d8x!r=j$Z$n'X)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SQ=t>QR=u>R%QeOPXYstuvw!Z!`!g!o#S#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&r&t&u&w&{'T'b'r(V(](d(x(z)O)}*i+X+]+g,p,s,x-i-q.P.V.g.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3d3l4z6T6e6f6i6|7[8t9T9_Y#bWZ#W#Z(T!b%jm#h#i#l$x%e%h(^(h(i(j*Y*^*b+Z+[+^,o-V.T.Z.[.]._/m/p2d3[3]4a6r7TQ,n&o!p=k$Z$n)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SR=n'XU']!e%i*ZR2s-`%SdOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&r&t&u&w&{'T'b'r(T(V(](d(x(z)O)}*i+X+],p,s,x-i-q.P.V.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3l4z6T6e6f6i6|8t9T9_!r)_$Z$n'X)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SQ,m&oQ0x+gQ3`.gQ7Y3dR9e7[!b$Tc#Y%q(S(Y(t(y)Z)[)`)g+x-x-}.S.U.s.v/b0p3O3V3k3{5X5c6{7Q7a9]:o<W!P<d)^)q-Z.|2k2n3p3y3z4P4X6u7b7k7l8k9X9g9m9n;W;`=v!f$Vc#Y%q(S(Y(t(y)W)X)Z)[)`)g+x-x-}.S.U.s.v/b0p3O3V3k3{5X5c6{7Q7a9]:o<W!T<f)^)q-Z.|2k2n3p3v3w3y3z4P4X6u7b7k7l8k9X9g9m9n;W;`=v!^$Zc#Y%q(S(Y(t(y)`)g+x-x-}.S.U.s.v/b0p3O3V3k3{5X5c6{7Q7a9]:o<WQ4_/kz>S)^)q-Z.|2k2n3p4P4X6u7b7k7l8k9X9g9m9n;W;`=vQ>X>ZR>Y>['QkOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>SS$oh$pR4U/U'XgOPWXYZhstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n$p%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/U/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>ST$kf$qQ$ifS)j$l)nR)v$qT$jf$qT)l$l)n'XhOPWXYZhstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$Z$_$a$e$n$p%m%t&R&k&n&o&r&t&u&w&{'T'X'b'r(T(V(](d(x(z)O)s)}*i+X+]+g,p,s,x-U-X-i-q.P.V.g.t.{/U/V/n0]0l0r1S1r2S2T2V2X2[2_2a2p3Q3W3d3l4T4z5w6T6e6f6i6s6|7[8t9T9_:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>ST$oh$pQ$rhR)u$p%^jOPWXYZstuvw!Z!`!g!o#S#W#Z#d#o#u#x#{$O$P$Q$R$S$T$U$V$W$X$_$a$e%m%t&R&k&n&o&r&t&u&w&{'T'b'r(T(V(](d(x(z)O)}*i+X+]+g,p,s,x-i-q.P.V.g.t.{/n0]0l0r1S1r2S2T2V2X2[2_2a3Q3W3d3l4z6T6e6f6i6|7[8t9T9_!s>Q$Z$n'X)s-U-X/V2p4T5w6s:Z:m<U<X<Y<]<^<_<`<a<b<c<d<e<f<g<h<i<k<n<{=O=P=R=Z=[=e=f>S#glOPXZst!Z!`!o#S#d#o#{$n%m&k&n&o&r&t&u&w&{'T'b)O)s*i+]+g,p,s,x-i.g/V/n0]0l1r2S2T2V2X2[2_2a3d4T4z6T6e6f6i7[8t9T!U%Ri$d%O%Q%^%_%c*R*T*a*w*x/P/x0`0b0i0j0o4_5Q8V9p>P>X>Y#f(w#v$b$c$x${)y*V*Y*g+f+i,S,V.f/d/m/y/{1f1i1q3c4^4j4o5[5_6S7W7v8Q8[8q9b9y:P:`:r;Q;[;d;k<o<q<u<w<y=S=U=X=]=_=a=c=g>]>^Q+T%aQ/c*Oo4O<l<m<p<r<v<x<z=T=V=Y=^=`=b=d=h!U$yi$d%O%Q%^%_%c*R*T*a*w*x/P/x0`0b0i0j0o4_5Q8V9p>P>X>YQ*c$zU*l$|*Z*oQ+U%bQ0W*m#f=q#v$b$c$x${)y*V*Y*g+f+i,S,V.f/d/m/y/{1f1i1q3c4^4j4o5[5_6S7W7v8Q8[8q9b9y:P:`:r;Q;[;d;k<o<q<u<w<y=S=U=X=]=_=a=c=g>]>^n=r<l<m<p<r<v<x<z=T=V=Y=^=`=b=d=hQ=w>TQ=x>UQ=y>VR=z>W!U%Ri$d%O%Q%^%_%c*R*T*a*w*x/P/x0`0b0i0j0o4_5Q8V9p>P>X>Y#f(w#v$b$c$x${)y*V*Y*g+f+i,S,V.f/d/m/y/{1f1i1q3c4^4j4o5[5_6S7W7v8Q8[8q9b9y:P:`:r;Q;[;d;k<o<q<u<w<y=S=U=X=]=_=a=c=g>]>^o4O<l<m<p<r<v<x<z=T=V=Y=^=`=b=d=hnoOXst!Z#d%m&r&t&u&w,s,x2[2_S*f${*YQ-R'OQ-S'QR4i/y%[%Si#v$b$c$d$x${%O%Q%^%_%c)y*R*T*V*Y*a*g*w*x+f+i,S,V.f/P/d/m/x/y/{0`0b0i0j0o1f1i1q3c4^4_4j4o5Q5[5_6S7W7v8Q8V8[8q9b9p9y:P:`:r;Q;[;d;k<l<m<o<p<q<r<u<v<w<x<y<z=S=T=U=V=X=Y=]=^=_=`=a=b=c=d=g=h>P>X>Y>]>^Q,U&]Q1h,WQ5s1gR8h5tV*n$|*Z*oU*n$|*Z*oT5z1o5{S0P*i/nQ4w0]T8S4z:]Q+j%xQ0V*lQ1O+kQ1u,aQ6W1vQ8v6XQ:c8wR;^:d!U%Oi$d%O%Q%^%_%c*R*T*a*w*x/P/x0`0b0i0j0o4_5Q8V9p>P>X>Yx*R$v)e*S*u+V/v0d0e4R4g5R5S5W7p8U:R:x=p=}>OS0`*t0a#f<o#v$b$c$x${)y*V*Y*g+f+i,S,V.f/d/m/y/{1f1i1q3c4^4j4o5[5_6S7W7v8Q8[8q9b9y:P:`:r;Q;[;d;k<o<q<u<w<y=S=U=X=]=_=a=c=g>]>^n<p<l<m<p<r<v<x<z=T=V=Y=^=`=b=d=h!d=S(u)c*[*e.j.m.q/_/k/|0v1e3h4[4h4l5r7]7`7w7z8X8Z9t9|:S:};R;e;j;v>Z>[`=T3}7c7f7j9h:t:w;yS=_.l3iT=`7e9k!U%Qi$d%O%Q%^%_%c*R*T*a*w*x/P/x0`0b0i0j0o4_5Q8V9p>P>X>Y|*T$v)e*U*t+V/g/v0d0e4R4g4|5R5S5W7p8U:R:x=p=}>OS0b*u0c#f<q#v$b$c$x${)y*V*Y*g+f+i,S,V.f/d/m/y/{1f1i1q3c4^4j4o5[5_6S7W7v8Q8[8q9b9y:P:`:r;Q;[;d;k<o<q<u<w<y=S=U=X=]=_=a=c=g>]>^n<r<l<m<p<r<v<x<z=T=V=Y=^=`=b=d=h!h=U(u)c*[*e.k.l.q/_/k/|0v1e3f3h4[4h4l5r7]7^7`7w7z8X8Z9t9|:S:};R;e;j;v>Z>[d=V3}7d7e7j9h9i:t:u:w;yS=a.m3jT=b7f9lrnOXst!V!Z#d%m&i&r&t&u&w,s,x2[2_Q&f!UR,p&ornOXst!V!Z#d%m&i&r&t&u&w,s,x2[2_R&f!UQ,Y&^R1d,RsnOXst!V!Z#d%m&i&r&t&u&w,s,x2[2_Q1p,_S6R1s1tU8p6P6Q6US:_8r8sS;Y:^:aQ;m;ZR;w;nQ&m!VR,i&iR6_1|R:f8yW&Q|&V&W,OR1Z+vQ&r!WR,s&sR,y&xT2],x2_R,}&yQ,|&yR2f,}Q'y!{R-y'ySsOtQ#dXT%ps#dQ#OTR'{#OQ#RUR'}#RQ){$uR/`){Q#UVR(Q#UQ#XWU(W#X(X.QQ(X#YR.Q(YQ-^'YR2r-^Q.u(yS3m.u3nR3n.vQ-e'`R2v-eY!rQ'`-e1o5{R'j!rQ/Q)eR4S/QU#_W%h*YU(_#_(`.RQ(`#`R.R(ZQ-a']R2t-at`OXst!V!Z#d%m&i&k&r&t&u&w,s,x2[2_S#hZ%eU#r`#h.[R.[(jQ(k#jQ.X(gW.a(k.X3X7RQ3X.YR7R3YQ)n$lR/W)nQ$phR)t$pQ$`cU)a$`-|<jQ-|<WR<j)qQ/q*]W4c/q4d7t9sU4d/r/s/tS7t4e4fR9s7u$e*Q$v(u)c)e*[*e*t*u+Q+R+V.l.m.o.p.q/_/g/i/k/v/|0d0e0v1e3f3g3h3}4R4[4g4h4l4|5O5R5S5W5r7]7^7_7`7e7f7h7i7j7p7w7z8U8X8Z9h9i9j9t9|:R:S:t:u:v:w:x:};R;e;j;v;y=p=}>O>Z>[Q/z*eU4k/z4m7xQ4m/|R7x4lS*o$|*ZR0Y*ox*S$v)e*t*u+V/v0d0e4R4g5R5S5W7p8U:R:x=p=}>O!d.j(u)c*[*e.l.m.q/_/k/|0v1e3h4[4h4l5r7]7`7w7z8X8Z9t9|:S:};R;e;j;v>Z>[U/h*S.j7ca7c3}7e7f7j9h:t:w;yQ0a*tQ3i.lU4}0a3i9kR9k7e|*U$v)e*t*u+V/g/v0d0e4R4g4|5R5S5W7p8U:R:x=p=}>O!h.k(u)c*[*e.l.m.q/_/k/|0v1e3f3h4[4h4l5r7]7^7`7w7z8X8Z9t9|:S:};R;e;j;v>Z>[U/j*U.k7de7d3}7e7f7j9h9i:t:u:w;yQ0c*uQ3j.mU5P0c3j9lR9l7fQ*z%UR0g*zQ5]0vR8Y5]Q+_%kR0u+_Q5v1jS8j5v:[R:[8kQ,[&_R1m,[Q5{1oR8m5{Q1{,fS6]1{8zR8z6_Q1U+rW5h1U5j8a:VQ5j1XQ8a5iR:V8bQ+w&QR1[+wQ2_,xR6m2_YrOXst#dQ&v!ZQ+a%mQ,r&rQ,t&tQ,u&uQ,w&wQ2Y,sS2],x2_R6l2[Q%opQ&z!_Q&}!aQ'P!bQ'R!cQ'q!uQ+`%lQ+l%zQ,Q&XQ,h&mQ-P&|W-p'k's't'wQ-w'oQ0X*nQ1P+mQ1c,PS2O,i,lQ2g-OQ2h-RQ2i-SQ2}-oW3P-r-s-v-xQ5a1QQ5m1_Q5q1eQ6V1uQ6a2QQ6k2ZU6z3O3R3UQ6}3SQ8]5bQ8e5oQ8g5rQ8l5zQ8u6WQ8{6`S9[6{7PQ9^7OQ:W8cQ:b8vQ:g8|Q:n9]Q;U:XQ;]:cQ;a:oQ;l;VR;o;^Q%zyQ'd!iQ'o!uU+m%{%|%}Q-W'VU-k'e'f'gS-o'k'uQ0Q*jS1Q+n+oQ2o-YS2{-l-mQ3S-tS4p0R0UQ5b1RQ6v2uQ6y2|Q7O3TU7{4r4s4vQ9z7}R;O9{S$wi>PR*{%VU%Ui%V>PR0f*yQ$viS(u#v+iS)c$b$cQ)e$dQ*[$xS*e${*YQ*t%OQ*u%QQ+Q%^Q+R%_Q+V%cQ.l<oQ.m<qQ.o<uQ.p<wQ.q<yQ/_)yQ/g*RQ/i*TQ/k*VQ/v*aS/|*g/mQ0d*wQ0e*xl0v+f,V.f1i1q3c6S7W8q9b:`:r;[;dQ1e,SQ3f=SQ3g=UQ3h=XS3}<l<mQ4R/PS4[/d4^Q4g/xQ4h/yQ4l/{Q4|0`Q5O0bQ5R0iQ5S0jQ5W0oQ5r1fQ7]=]Q7^=_Q7_=aQ7`=cQ7e<pQ7f<rQ7h<vQ7i<xQ7j<zQ7p4_Q7w4jQ7z4oQ8U5QQ8X5[Q8Z5_Q9h=YQ9i=TQ9j=VQ9t7vQ9|8QQ:R8VQ:S8[Q:t=^Q:u=`Q:v=bQ:w=dQ:x9pQ:}9yQ;R:PQ;e=gQ;j;QQ;v;kQ;y=hQ=p>PQ=}>XQ>O>YQ>Z>]R>[>^Q+O%]Q.n<sR7g<tnpOXst!Z#d%m&r&t&u&w,s,x2[2_Q!fPS#fZ#oQ&|!`W'h!o*i0]4zQ(P#SQ)Q#{Q)r$nS,l&k&nQ,q&oQ-O&{S-T'T/nQ-g'bQ.x)OQ/[)sQ0s+]Q0y+gQ2W,pQ2y-iQ3a.gQ4W/VQ5U0lQ6Q1rQ6c2SQ6d2TQ6h2VQ6j2XQ6o2aQ7Z3dQ7m4TQ8s6TQ9P6eQ9Q6fQ9S6iQ9f7[Q:a8tR:k9T#[cOPXZst!Z!`!o#d#o#{%m&k&n&o&r&t&u&w&{'T'b)O*i+]+g,p,s,x-i.g/n0]0l1r2S2T2V2X2[2_2a3d4z6T6e6f6i7[8t9TQ#YWQ#eYQ%quQ%svS%uw!gS(S#W(VQ(Y#ZQ(t#uQ(y#xQ)R$OQ)S$PQ)T$QQ)U$RQ)V$SQ)W$TQ)X$UQ)Y$VQ)Z$WQ)[$XQ)^$ZQ)`$_Q)b$aQ)g$eW)q$n)s/V4TQ+d%tQ+x&RS-Z'X2pQ-x'rS-}(T.PQ.S(]Q.U(dQ.s(xQ.v(zQ.z<UQ.|<XQ.}<YQ/O<]Q/b)}Q0p+XQ2k-UQ2n-XQ3O-qQ3V.VQ3k.tQ3p<^Q3q<_Q3r<`Q3s<aQ3t<bQ3u<cQ3v<dQ3w<eQ3x<fQ3y<gQ3z<hQ3{.{Q3|<kQ4P<nQ4Q<{Q4X<iQ5X0rQ5c1SQ6u=OQ6{3QQ7Q3WQ7a3lQ7b=PQ7k=RQ7l=ZQ8k5wQ9X6sQ9]6|Q9g=[Q9m=eQ9n=fQ:o9_Q;W:ZQ;`:mQ<W#SR=v>SR#[WR'Z!el!tQ!r!v!y!z'`'l'm'n-e-u1o5{5}S'V!e-]U*j$|*Z*oS-Y'W'_S0U*k*qQ0^*rQ2u-cQ4v0[R4{0_R({#xQ!fQT-d'`-e]!qQ!r'`-e1o5{Q#p]R'i<VR)f$dY!uQ'`-e1o5{Q'k!rS'u!v!yS'w!z5}S-t'l'mQ-v'nR3T-uT#kZ%eS#jZ%eS%km,oU(g#h#i#lS.Y(h(iQ.^(jQ0t+^Q3Y.ZU3Z.[.]._S7S3[3]R9`7Td#^W#W#Z%h(T(^*Y+Z.T/mr#gZm#h#i#l%e(h(i(j+^.Z.[.]._3[3]7TS*]$x*bQ/t*^Q2U,oQ2l-VQ4`/pQ6q2dQ7s4aQ9W6rT=m'X+[V#aW%h*YU#`W%h*YS(U#W(^U(Z#Z+Z/mS-['X+[T.O(T.TV'^!e%i*ZQ$lfR)x$qT)m$l)nR4V/UT*_$x*bT*h${*YQ0w+fQ1g,VQ3_.fQ5t1iQ6P1qQ7X3cQ8r6SQ9c7WQ:^8qQ:p9bQ;Z:`Q;c:rQ;n;[R;q;dnqOXst!Z#d%m&r&t&u&w,s,x2[2_Q&l!VR,h&itmOXst!U!V!Z#d%m&i&r&t&u&w,s,x2[2_R,o&oT%lm,oR1k,XR,g&gQ&U|S+}&V&WR1^,OR+s&PT&p!W&sT&q!W&sT2^,x2_",
  nodeNames: "⚠ ArithOp ArithOp ?. JSXStartTag LineComment BlockComment Script Hashbang ExportDeclaration export Star as VariableName String Escape from ; default FunctionDeclaration async function VariableDefinition > < TypeParamList in out const TypeDefinition extends ThisType this LiteralType ArithOp Number BooleanLiteral TemplateType InterpolationEnd Interpolation InterpolationStart NullType null VoidType void TypeofType typeof MemberExpression . PropertyName [ TemplateString Escape Interpolation super RegExp ] ArrayExpression Spread , } { ObjectExpression Property async get set PropertyDefinition Block : NewTarget new NewExpression ) ( ArgList UnaryExpression delete LogicOp BitOp YieldExpression yield AwaitExpression await ParenthesizedExpression ClassExpression class ClassBody MethodDeclaration Decorator @ MemberExpression PrivatePropertyName CallExpression TypeArgList CompareOp < declare Privacy static abstract override PrivatePropertyDefinition PropertyDeclaration readonly accessor Optional TypeAnnotation Equals StaticBlock FunctionExpression ArrowFunction ParamList ParamList ArrayPattern ObjectPattern PatternProperty Privacy readonly Arrow MemberExpression BinaryExpression ArithOp ArithOp ArithOp ArithOp BitOp CompareOp instanceof satisfies CompareOp BitOp BitOp BitOp LogicOp LogicOp ConditionalExpression LogicOp LogicOp AssignmentExpression UpdateOp PostfixExpression CallExpression InstantiationExpression TaggedTemplateExpression DynamicImport import ImportMeta JSXElement JSXSelfCloseEndTag JSXSelfClosingTag JSXIdentifier JSXBuiltin JSXIdentifier JSXNamespacedName JSXMemberExpression JSXSpreadAttribute JSXAttribute JSXAttributeValue JSXEscape JSXEndTag JSXOpenTag JSXFragmentTag JSXText JSXEscape JSXStartCloseTag JSXCloseTag PrefixCast < ArrowFunction TypeParamList SequenceExpression InstantiationExpression KeyofType keyof UniqueType unique ImportType InferredType infer TypeName ParenthesizedType FunctionSignature ParamList NewSignature IndexedType TupleType Label ArrayType ReadonlyType ObjectType MethodType PropertyType IndexSignature PropertyDefinition CallSignature TypePredicate asserts is NewSignature new UnionType LogicOp IntersectionType LogicOp ConditionalType ParameterizedType ClassDeclaration abstract implements type VariableDeclaration let var using TypeAliasDeclaration InterfaceDeclaration interface EnumDeclaration enum EnumBody NamespaceDeclaration namespace module AmbientDeclaration declare GlobalDeclaration global ClassDeclaration ClassBody AmbientFunctionDeclaration ExportGroup VariableName VariableName ImportDeclaration defer ImportGroup ForStatement for ForSpec ForInSpec ForOfSpec of WhileStatement while WithStatement with DoStatement do IfStatement if else SwitchStatement switch SwitchBody CaseLabel case DefaultLabel TryStatement try CatchClause catch FinallyClause finally ReturnStatement return ThrowStatement throw BreakStatement break ContinueStatement continue DebuggerStatement debugger LabeledStatement ExpressionStatement SingleExpression SingleClassItem",
  maxTerm: 380,
  context: trackNewline,
  nodeProps: [
    ["isolate", -8,5,6,14,37,39,51,53,55,""],
    ["group", -26,9,17,19,68,207,211,215,216,218,221,224,234,237,243,245,247,249,252,258,264,266,268,270,272,274,275,"Statement",-34,13,14,32,35,36,42,51,54,55,57,62,70,72,76,80,82,84,85,110,111,120,121,136,139,141,142,143,144,145,147,148,167,169,171,"Expression",-23,31,33,37,41,43,45,173,175,177,178,180,181,182,184,185,186,188,189,190,201,203,205,206,"Type",-3,88,103,109,"ClassItem"],
    ["openedBy", 23,"<",38,"InterpolationStart",56,"[",60,"{",73,"(",160,"JSXStartCloseTag"],
    ["closedBy", -2,24,168,">",40,"InterpolationEnd",50,"]",61,"}",74,")",165,"JSXEndTag"]
  ],
  propSources: [jsHighlight],
  skippedNodes: [0,5,6,278],
  repeatNodeCount: 37,
  tokenData: "$Fq07[R!bOX%ZXY+gYZ-yZ[+g[]%Z]^.c^p%Zpq+gqr/mrs3cst:_tuEruvJSvwLkwx! Yxy!'iyz!(sz{!)}{|!,q|}!.O}!O!,q!O!P!/Y!P!Q!9j!Q!R#:O!R![#<_![!]#I_!]!^#Jk!^!_#Ku!_!`$![!`!a$$v!a!b$*T!b!c$,r!c!}Er!}#O$-|#O#P$/W#P#Q$4o#Q#R$5y#R#SEr#S#T$7W#T#o$8b#o#p$<r#p#q$=h#q#r$>x#r#s$@U#s$f%Z$f$g+g$g#BYEr#BY#BZ$A`#BZ$ISEr$IS$I_$A`$I_$I|Er$I|$I}$Dk$I}$JO$Dk$JO$JTEr$JT$JU$A`$JU$KVEr$KV$KW$A`$KW&FUEr&FU&FV$A`&FV;'SEr;'S;=`I|<%l?HTEr?HT?HU$A`?HUOEr(n%d_$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z&j&hT$i&jO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c&j&zP;=`<%l&c'|'U]$i&j(Z!bOY&}YZ&cZw&}wx&cx!^&}!^!_'}!_#O&}#O#P&c#P#o&}#o#p'}#p;'S&};'S;=`(l<%lO&}!b(SU(Z!bOY'}Zw'}x#O'}#P;'S'};'S;=`(f<%lO'}!b(iP;=`<%l'}'|(oP;=`<%l&}'[(y]$i&j(WpOY(rYZ&cZr(rrs&cs!^(r!^!_)r!_#O(r#O#P&c#P#o(r#o#p)r#p;'S(r;'S;=`*a<%lO(rp)wU(WpOY)rZr)rs#O)r#P;'S)r;'S;=`*Z<%lO)rp*^P;=`<%l)r'[*dP;=`<%l(r#S*nX(Wp(Z!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g#S+^P;=`<%l*g(n+dP;=`<%l%Z07[+rq$i&j(Wp(Z!b'|0/lOX%ZXY+gYZ&cZ[+g[p%Zpq+gqr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p$f%Z$f$g+g$g#BY%Z#BY#BZ+g#BZ$IS%Z$IS$I_+g$I_$JT%Z$JT$JU+g$JU$KV%Z$KV$KW+g$KW&FU%Z&FU&FV+g&FV;'S%Z;'S;=`+a<%l?HT%Z?HT?HU+g?HUO%Z07[.ST(X#S$i&j'}0/lO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c07[.n_$i&j(Wp(Z!b'}0/lOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z)3p/x`$i&j!p),Q(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`0z!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW1V`#v(Ch$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`2X!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW2d_#v(Ch$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'At3l_(V':f$i&j(Z!bOY4kYZ5qZr4krs7nsw4kwx5qx!^4k!^!_8p!_#O4k#O#P5q#P#o4k#o#p8p#p;'S4k;'S;=`:X<%lO4k(^4r_$i&j(Z!bOY4kYZ5qZr4krs7nsw4kwx5qx!^4k!^!_8p!_#O4k#O#P5q#P#o4k#o#p8p#p;'S4k;'S;=`:X<%lO4k&z5vX$i&jOr5qrs6cs!^5q!^!_6y!_#o5q#o#p6y#p;'S5q;'S;=`7h<%lO5q&z6jT$d`$i&jO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c`6|TOr6yrs7]s;'S6y;'S;=`7b<%lO6y`7bO$d``7eP;=`<%l6y&z7kP;=`<%l5q(^7w]$d`$i&j(Z!bOY&}YZ&cZw&}wx&cx!^&}!^!_'}!_#O&}#O#P&c#P#o&}#o#p'}#p;'S&};'S;=`(l<%lO&}!r8uZ(Z!bOY8pYZ6yZr8prs9hsw8pwx6yx#O8p#O#P6y#P;'S8p;'S;=`:R<%lO8p!r9oU$d`(Z!bOY'}Zw'}x#O'}#P;'S'};'S;=`(f<%lO'}!r:UP;=`<%l8p(^:[P;=`<%l4k%9[:hh$i&j(Wp(Z!bOY%ZYZ&cZq%Zqr<Srs&}st%ZtuCruw%Zwx(rx!^%Z!^!_*g!_!c%Z!c!}Cr!}#O%Z#O#P&c#P#R%Z#R#SCr#S#T%Z#T#oCr#o#p*g#p$g%Z$g;'SCr;'S;=`El<%lOCr(r<__WS$i&j(Wp(Z!bOY<SYZ&cZr<Srs=^sw<Swx@nx!^<S!^!_Bm!_#O<S#O#P>`#P#o<S#o#pBm#p;'S<S;'S;=`Cl<%lO<S(Q=g]WS$i&j(Z!bOY=^YZ&cZw=^wx>`x!^=^!^!_?q!_#O=^#O#P>`#P#o=^#o#p?q#p;'S=^;'S;=`@h<%lO=^&n>gXWS$i&jOY>`YZ&cZ!^>`!^!_?S!_#o>`#o#p?S#p;'S>`;'S;=`?k<%lO>`S?XSWSOY?SZ;'S?S;'S;=`?e<%lO?SS?hP;=`<%l?S&n?nP;=`<%l>`!f?xWWS(Z!bOY?qZw?qwx?Sx#O?q#O#P?S#P;'S?q;'S;=`@b<%lO?q!f@eP;=`<%l?q(Q@kP;=`<%l=^'`@w]WS$i&j(WpOY@nYZ&cZr@nrs>`s!^@n!^!_Ap!_#O@n#O#P>`#P#o@n#o#pAp#p;'S@n;'S;=`Bg<%lO@ntAwWWS(WpOYApZrAprs?Ss#OAp#O#P?S#P;'SAp;'S;=`Ba<%lOAptBdP;=`<%lAp'`BjP;=`<%l@n#WBvYWS(Wp(Z!bOYBmZrBmrs?qswBmwxApx#OBm#O#P?S#P;'SBm;'S;=`Cf<%lOBm#WCiP;=`<%lBm(rCoP;=`<%l<S%9[C}i$i&j(o%1l(Wp(Z!bOY%ZYZ&cZr%Zrs&}st%ZtuCruw%Zwx(rx!Q%Z!Q![Cr![!^%Z!^!_*g!_!c%Z!c!}Cr!}#O%Z#O#P&c#P#R%Z#R#SCr#S#T%Z#T#oCr#o#p*g#p$g%Z$g;'SCr;'S;=`El<%lOCr%9[EoP;=`<%lCr07[FRk$i&j(Wp(Z!b$]#t(T,2j(e$I[OY%ZYZ&cZr%Zrs&}st%ZtuEruw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Er![!^%Z!^!_*g!_!c%Z!c!}Er!}#O%Z#O#P&c#P#R%Z#R#SEr#S#T%Z#T#oEr#o#p*g#p$g%Z$g;'SEr;'S;=`I|<%lOEr+dHRk$i&j(Wp(Z!b$]#tOY%ZYZ&cZr%Zrs&}st%ZtuGvuw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Gv![!^%Z!^!_*g!_!c%Z!c!}Gv!}#O%Z#O#P&c#P#R%Z#R#SGv#S#T%Z#T#oGv#o#p*g#p$g%Z$g;'SGv;'S;=`Iv<%lOGv+dIyP;=`<%lGv07[JPP;=`<%lEr(KWJ_`$i&j(Wp(Z!b#p(ChOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KWKl_$i&j$Q(Ch(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z,#xLva(z+JY$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sv%ZvwM{wx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KWNW`$i&j#z(Ch(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'At! c_(Y';W$i&j(WpOY!!bYZ!#hZr!!brs!#hsw!!bwx!$xx!^!!b!^!_!%z!_#O!!b#O#P!#h#P#o!!b#o#p!%z#p;'S!!b;'S;=`!'c<%lO!!b'l!!i_$i&j(WpOY!!bYZ!#hZr!!brs!#hsw!!bwx!$xx!^!!b!^!_!%z!_#O!!b#O#P!#h#P#o!!b#o#p!%z#p;'S!!b;'S;=`!'c<%lO!!b&z!#mX$i&jOw!#hwx6cx!^!#h!^!_!$Y!_#o!#h#o#p!$Y#p;'S!#h;'S;=`!$r<%lO!#h`!$]TOw!$Ywx7]x;'S!$Y;'S;=`!$l<%lO!$Y`!$oP;=`<%l!$Y&z!$uP;=`<%l!#h'l!%R]$d`$i&j(WpOY(rYZ&cZr(rrs&cs!^(r!^!_)r!_#O(r#O#P&c#P#o(r#o#p)r#p;'S(r;'S;=`*a<%lO(r!Q!&PZ(WpOY!%zYZ!$YZr!%zrs!$Ysw!%zwx!&rx#O!%z#O#P!$Y#P;'S!%z;'S;=`!']<%lO!%z!Q!&yU$d`(WpOY)rZr)rs#O)r#P;'S)r;'S;=`*Z<%lO)r!Q!'`P;=`<%l!%z'l!'fP;=`<%l!!b/5|!'t_!l/.^$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z#&U!)O_!k!Lf$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z-!n!*[b$i&j(Wp(Z!b(U%&f#q(ChOY%ZYZ&cZr%Zrs&}sw%Zwx(rxz%Zz{!+d{!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW!+o`$i&j(Wp(Z!b#n(ChOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z+;x!,|`$i&j(Wp(Z!br+4YOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z,$U!.Z_!]+Jf$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[!/ec$i&j(Wp(Z!b!Q.2^OY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!0p!P!Q%Z!Q![!3Y![!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z#%|!0ya$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!2O!P!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z#%|!2Z_![!L^$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!3eg$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![!3Y![!^%Z!^!_*g!_!g%Z!g!h!4|!h#O%Z#O#P&c#P#R%Z#R#S!3Y#S#X%Z#X#Y!4|#Y#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!5Vg$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx{%Z{|!6n|}%Z}!O!6n!O!Q%Z!Q![!8S![!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S!8S#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!6wc$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![!8S![!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S!8S#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad!8_c$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![!8S![!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S!8S#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[!9uf$i&j(Wp(Z!b#o(ChOY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcxz!;Zz{#-}{!P!;Z!P!Q#/d!Q!^!;Z!^!_#(i!_!`#7S!`!a#8i!a!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z?O!;fb$i&j(Wp(Z!b!X7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z>^!<w`$i&j(Z!b!X7`OY!<nYZ&cZw!<nwx!=yx!P!<n!P!Q!Eq!Q!^!<n!^!_!Gr!_!}!<n!}#O!KS#O#P!Dy#P#o!<n#o#p!Gr#p;'S!<n;'S;=`!L]<%lO!<n<z!>Q^$i&j!X7`OY!=yYZ&cZ!P!=y!P!Q!>|!Q!^!=y!^!_!@c!_!}!=y!}#O!CW#O#P!Dy#P#o!=y#o#p!@c#p;'S!=y;'S;=`!Ek<%lO!=y<z!?Td$i&j!X7`O!^&c!_#W&c#W#X!>|#X#Z&c#Z#[!>|#[#]&c#]#^!>|#^#a&c#a#b!>|#b#g&c#g#h!>|#h#i&c#i#j!>|#j#k!>|#k#m&c#m#n!>|#n#o&c#p;'S&c;'S;=`&w<%lO&c7`!@hX!X7`OY!@cZ!P!@c!P!Q!AT!Q!}!@c!}#O!Ar#O#P!Bq#P;'S!@c;'S;=`!CQ<%lO!@c7`!AYW!X7`#W#X!AT#Z#[!AT#]#^!AT#a#b!AT#g#h!AT#i#j!AT#j#k!AT#m#n!AT7`!AuVOY!ArZ#O!Ar#O#P!B[#P#Q!@c#Q;'S!Ar;'S;=`!Bk<%lO!Ar7`!B_SOY!ArZ;'S!Ar;'S;=`!Bk<%lO!Ar7`!BnP;=`<%l!Ar7`!BtSOY!@cZ;'S!@c;'S;=`!CQ<%lO!@c7`!CTP;=`<%l!@c<z!C][$i&jOY!CWYZ&cZ!^!CW!^!_!Ar!_#O!CW#O#P!DR#P#Q!=y#Q#o!CW#o#p!Ar#p;'S!CW;'S;=`!Ds<%lO!CW<z!DWX$i&jOY!CWYZ&cZ!^!CW!^!_!Ar!_#o!CW#o#p!Ar#p;'S!CW;'S;=`!Ds<%lO!CW<z!DvP;=`<%l!CW<z!EOX$i&jOY!=yYZ&cZ!^!=y!^!_!@c!_#o!=y#o#p!@c#p;'S!=y;'S;=`!Ek<%lO!=y<z!EnP;=`<%l!=y>^!Ezl$i&j(Z!b!X7`OY&}YZ&cZw&}wx&cx!^&}!^!_'}!_#O&}#O#P&c#P#W&}#W#X!Eq#X#Z&}#Z#[!Eq#[#]&}#]#^!Eq#^#a&}#a#b!Eq#b#g&}#g#h!Eq#h#i&}#i#j!Eq#j#k!Eq#k#m&}#m#n!Eq#n#o&}#o#p'}#p;'S&};'S;=`(l<%lO&}8r!GyZ(Z!b!X7`OY!GrZw!Grwx!@cx!P!Gr!P!Q!Hl!Q!}!Gr!}#O!JU#O#P!Bq#P;'S!Gr;'S;=`!J|<%lO!Gr8r!Hse(Z!b!X7`OY'}Zw'}x#O'}#P#W'}#W#X!Hl#X#Z'}#Z#[!Hl#[#]'}#]#^!Hl#^#a'}#a#b!Hl#b#g'}#g#h!Hl#h#i'}#i#j!Hl#j#k!Hl#k#m'}#m#n!Hl#n;'S'};'S;=`(f<%lO'}8r!JZX(Z!bOY!JUZw!JUwx!Arx#O!JU#O#P!B[#P#Q!Gr#Q;'S!JU;'S;=`!Jv<%lO!JU8r!JyP;=`<%l!JU8r!KPP;=`<%l!Gr>^!KZ^$i&j(Z!bOY!KSYZ&cZw!KSwx!CWx!^!KS!^!_!JU!_#O!KS#O#P!DR#P#Q!<n#Q#o!KS#o#p!JU#p;'S!KS;'S;=`!LV<%lO!KS>^!LYP;=`<%l!KS>^!L`P;=`<%l!<n=l!Ll`$i&j(Wp!X7`OY!LcYZ&cZr!Lcrs!=ys!P!Lc!P!Q!Mn!Q!^!Lc!^!_# o!_!}!Lc!}#O#%P#O#P!Dy#P#o!Lc#o#p# o#p;'S!Lc;'S;=`#&Y<%lO!Lc=l!Mwl$i&j(Wp!X7`OY(rYZ&cZr(rrs&cs!^(r!^!_)r!_#O(r#O#P&c#P#W(r#W#X!Mn#X#Z(r#Z#[!Mn#[#](r#]#^!Mn#^#a(r#a#b!Mn#b#g(r#g#h!Mn#h#i(r#i#j!Mn#j#k!Mn#k#m(r#m#n!Mn#n#o(r#o#p)r#p;'S(r;'S;=`*a<%lO(r8Q# vZ(Wp!X7`OY# oZr# ors!@cs!P# o!P!Q#!i!Q!}# o!}#O#$R#O#P!Bq#P;'S# o;'S;=`#$y<%lO# o8Q#!pe(Wp!X7`OY)rZr)rs#O)r#P#W)r#W#X#!i#X#Z)r#Z#[#!i#[#])r#]#^#!i#^#a)r#a#b#!i#b#g)r#g#h#!i#h#i)r#i#j#!i#j#k#!i#k#m)r#m#n#!i#n;'S)r;'S;=`*Z<%lO)r8Q#$WX(WpOY#$RZr#$Rrs!Ars#O#$R#O#P!B[#P#Q# o#Q;'S#$R;'S;=`#$s<%lO#$R8Q#$vP;=`<%l#$R8Q#$|P;=`<%l# o=l#%W^$i&j(WpOY#%PYZ&cZr#%Prs!CWs!^#%P!^!_#$R!_#O#%P#O#P!DR#P#Q!Lc#Q#o#%P#o#p#$R#p;'S#%P;'S;=`#&S<%lO#%P=l#&VP;=`<%l#%P=l#&]P;=`<%l!Lc?O#&kn$i&j(Wp(Z!b!X7`OY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#W%Z#W#X#&`#X#Z%Z#Z#[#&`#[#]%Z#]#^#&`#^#a%Z#a#b#&`#b#g%Z#g#h#&`#h#i%Z#i#j#&`#j#k#&`#k#m%Z#m#n#&`#n#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z9d#(r](Wp(Z!b!X7`OY#(iZr#(irs!Grsw#(iwx# ox!P#(i!P!Q#)k!Q!}#(i!}#O#+`#O#P!Bq#P;'S#(i;'S;=`#,`<%lO#(i9d#)th(Wp(Z!b!X7`OY*gZr*grs'}sw*gwx)rx#O*g#P#W*g#W#X#)k#X#Z*g#Z#[#)k#[#]*g#]#^#)k#^#a*g#a#b#)k#b#g*g#g#h#)k#h#i*g#i#j#)k#j#k#)k#k#m*g#m#n#)k#n;'S*g;'S;=`+Z<%lO*g9d#+gZ(Wp(Z!bOY#+`Zr#+`rs!JUsw#+`wx#$Rx#O#+`#O#P!B[#P#Q#(i#Q;'S#+`;'S;=`#,Y<%lO#+`9d#,]P;=`<%l#+`9d#,cP;=`<%l#(i?O#,o`$i&j(Wp(Z!bOY#,fYZ&cZr#,frs!KSsw#,fwx#%Px!^#,f!^!_#+`!_#O#,f#O#P!DR#P#Q!;Z#Q#o#,f#o#p#+`#p;'S#,f;'S;=`#-q<%lO#,f?O#-tP;=`<%l#,f?O#-zP;=`<%l!;Z07[#.[b$i&j(Wp(Z!b(O0/l!X7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z07[#/o_$i&j(Wp(Z!bT0/lOY#/dYZ&cZr#/drs#0nsw#/dwx#4Ox!^#/d!^!_#5}!_#O#/d#O#P#1p#P#o#/d#o#p#5}#p;'S#/d;'S;=`#6|<%lO#/d06j#0w]$i&j(Z!bT0/lOY#0nYZ&cZw#0nwx#1px!^#0n!^!_#3R!_#O#0n#O#P#1p#P#o#0n#o#p#3R#p;'S#0n;'S;=`#3x<%lO#0n05W#1wX$i&jT0/lOY#1pYZ&cZ!^#1p!^!_#2d!_#o#1p#o#p#2d#p;'S#1p;'S;=`#2{<%lO#1p0/l#2iST0/lOY#2dZ;'S#2d;'S;=`#2u<%lO#2d0/l#2xP;=`<%l#2d05W#3OP;=`<%l#1p01O#3YW(Z!bT0/lOY#3RZw#3Rwx#2dx#O#3R#O#P#2d#P;'S#3R;'S;=`#3r<%lO#3R01O#3uP;=`<%l#3R06j#3{P;=`<%l#0n05x#4X]$i&j(WpT0/lOY#4OYZ&cZr#4Ors#1ps!^#4O!^!_#5Q!_#O#4O#O#P#1p#P#o#4O#o#p#5Q#p;'S#4O;'S;=`#5w<%lO#4O00^#5XW(WpT0/lOY#5QZr#5Qrs#2ds#O#5Q#O#P#2d#P;'S#5Q;'S;=`#5q<%lO#5Q00^#5tP;=`<%l#5Q05x#5zP;=`<%l#4O01p#6WY(Wp(Z!bT0/lOY#5}Zr#5}rs#3Rsw#5}wx#5Qx#O#5}#O#P#2d#P;'S#5};'S;=`#6v<%lO#5}01p#6yP;=`<%l#5}07[#7PP;=`<%l#/d)3h#7ab$i&j$Q(Ch(Wp(Z!b!X7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;ZAt#8vb$Z#t$i&j(Wp(Z!b!X7`OY!;ZYZ&cZr!;Zrs!<nsw!;Zwx!Lcx!P!;Z!P!Q#&`!Q!^!;Z!^!_#(i!_!}!;Z!}#O#,f#O#P!Dy#P#o!;Z#o#p#(i#p;'S!;Z;'S;=`#-w<%lO!;Z'Ad#:Zp$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!3Y!P!Q%Z!Q![#<_![!^%Z!^!_*g!_!g%Z!g!h!4|!h#O%Z#O#P&c#P#R%Z#R#S#<_#S#U%Z#U#V#?i#V#X%Z#X#Y!4|#Y#b%Z#b#c#>_#c#d#Bq#d#l%Z#l#m#Es#m#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#<jk$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!O%Z!O!P!3Y!P!Q%Z!Q![#<_![!^%Z!^!_*g!_!g%Z!g!h!4|!h#O%Z#O#P&c#P#R%Z#R#S#<_#S#X%Z#X#Y!4|#Y#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#>j_$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#?rd$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!R#AQ!R!S#AQ!S!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#AQ#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#A]f$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!R#AQ!R!S#AQ!S!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#AQ#S#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#Bzc$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!Y#DV!Y!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#DV#S#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#Dbe$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q!Y#DV!Y!^%Z!^!_*g!_#O%Z#O#P&c#P#R%Z#R#S#DV#S#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#E|g$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![#Ge![!^%Z!^!_*g!_!c%Z!c!i#Ge!i#O%Z#O#P&c#P#R%Z#R#S#Ge#S#T%Z#T#Z#Ge#Z#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z'Ad#Gpi$i&j(Wp(Z!bs'9tOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!Q%Z!Q![#Ge![!^%Z!^!_*g!_!c%Z!c!i#Ge!i#O%Z#O#P&c#P#R%Z#R#S#Ge#S#T%Z#T#Z#Ge#Z#b%Z#b#c#>_#c#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z*)x#Il_!g$b$i&j$O)Lv(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z)[#Jv_al$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z04f#LS^h#)`#R-<U(Wp(Z!b$n7`OY*gZr*grs'}sw*gwx)rx!P*g!P!Q#MO!Q!^*g!^!_#Mt!_!`$ f!`#O*g#P;'S*g;'S;=`+Z<%lO*g(n#MXX$k&j(Wp(Z!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g(El#M}Z#r(Ch(Wp(Z!bOY*gZr*grs'}sw*gwx)rx!_*g!_!`#Np!`#O*g#P;'S*g;'S;=`+Z<%lO*g(El#NyX$Q(Ch(Wp(Z!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g(El$ oX#s(Ch(Wp(Z!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g*)x$!ga#`*!Y$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`0z!`!a$#l!a#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(K[$#w_#k(Cl$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z*)x$%Vag!*r#s(Ch$f#|$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`$&[!`!a$'f!a#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$&g_#s(Ch$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$'qa#r(Ch$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`!a$(v!a#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$)R`#r(Ch$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(Kd$*`a(r(Ct$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!a%Z!a!b$+e!b#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$+p`$i&j#{(Ch(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z%#`$,}_!|$Ip$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z04f$.X_!S0,v$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(n$/]Z$i&jO!^$0O!^!_$0f!_#i$0O#i#j$0k#j#l$0O#l#m$2^#m#o$0O#o#p$0f#p;'S$0O;'S;=`$4i<%lO$0O(n$0VT_#S$i&jO!^&c!_#o&c#p;'S&c;'S;=`&w<%lO&c#S$0kO_#S(n$0p[$i&jO!Q&c!Q![$1f![!^&c!_!c&c!c!i$1f!i#T&c#T#Z$1f#Z#o&c#o#p$3|#p;'S&c;'S;=`&w<%lO&c(n$1kZ$i&jO!Q&c!Q![$2^![!^&c!_!c&c!c!i$2^!i#T&c#T#Z$2^#Z#o&c#p;'S&c;'S;=`&w<%lO&c(n$2cZ$i&jO!Q&c!Q![$3U![!^&c!_!c&c!c!i$3U!i#T&c#T#Z$3U#Z#o&c#p;'S&c;'S;=`&w<%lO&c(n$3ZZ$i&jO!Q&c!Q![$0O![!^&c!_!c&c!c!i$0O!i#T&c#T#Z$0O#Z#o&c#p;'S&c;'S;=`&w<%lO&c#S$4PR!Q![$4Y!c!i$4Y#T#Z$4Y#S$4]S!Q![$4Y!c!i$4Y#T#Z$4Y#q#r$0f(n$4lP;=`<%l$0O#1[$4z_!Y#)l$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z(KW$6U`#x(Ch$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z+;p$7c_$i&j(Wp(Z!b(a+4QOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[$8qk$i&j(Wp(Z!b(T,2j$_#t(e$I[OY%ZYZ&cZr%Zrs&}st%Ztu$8buw%Zwx(rx}%Z}!O$:f!O!Q%Z!Q![$8b![!^%Z!^!_*g!_!c%Z!c!}$8b!}#O%Z#O#P&c#P#R%Z#R#S$8b#S#T%Z#T#o$8b#o#p*g#p$g%Z$g;'S$8b;'S;=`$<l<%lO$8b+d$:qk$i&j(Wp(Z!b$_#tOY%ZYZ&cZr%Zrs&}st%Ztu$:fuw%Zwx(rx}%Z}!O$:f!O!Q%Z!Q![$:f![!^%Z!^!_*g!_!c%Z!c!}$:f!}#O%Z#O#P&c#P#R%Z#R#S$:f#S#T%Z#T#o$:f#o#p*g#p$g%Z$g;'S$:f;'S;=`$<f<%lO$:f+d$<iP;=`<%l$:f07[$<oP;=`<%l$8b#Jf$<{X!_#Hb(Wp(Z!bOY*gZr*grs'}sw*gwx)rx#O*g#P;'S*g;'S;=`+Z<%lO*g,#x$=sa(y+JY$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_!`Ka!`#O%Z#O#P&c#P#o%Z#o#p*g#p#q$+e#q;'S%Z;'S;=`+a<%lO%Z)>v$?V_!^(CdvBr$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z?O$@a_!q7`$i&j(Wp(Z!bOY%ZYZ&cZr%Zrs&}sw%Zwx(rx!^%Z!^!_*g!_#O%Z#O#P&c#P#o%Z#o#p*g#p;'S%Z;'S;=`+a<%lO%Z07[$Aq|$i&j(Wp(Z!b'|0/l$]#t(T,2j(e$I[OX%ZXY+gYZ&cZ[+g[p%Zpq+gqr%Zrs&}st%ZtuEruw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Er![!^%Z!^!_*g!_!c%Z!c!}Er!}#O%Z#O#P&c#P#R%Z#R#SEr#S#T%Z#T#oEr#o#p*g#p$f%Z$f$g+g$g#BYEr#BY#BZ$A`#BZ$ISEr$IS$I_$A`$I_$JTEr$JT$JU$A`$JU$KVEr$KV$KW$A`$KW&FUEr&FU&FV$A`&FV;'SEr;'S;=`I|<%l?HTEr?HT?HU$A`?HUOEr07[$D|k$i&j(Wp(Z!b'}0/l$]#t(T,2j(e$I[OY%ZYZ&cZr%Zrs&}st%ZtuEruw%Zwx(rx}%Z}!OGv!O!Q%Z!Q![Er![!^%Z!^!_*g!_!c%Z!c!}Er!}#O%Z#O#P&c#P#R%Z#R#SEr#S#T%Z#T#oEr#o#p*g#p$g%Z$g;'SEr;'S;=`I|<%lOEr",
  tokenizers: [noSemicolon, noSemicolonType, operatorToken, jsx, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, insertSemicolon, new LocalTokenGroup("$S~RRtu[#O#Pg#S#T#|~_P#o#pb~gOx~~jVO#i!P#i#j!U#j#l!P#l#m!q#m;'S!P;'S;=`#v<%lO!P~!UO!U~~!XS!Q![!e!c!i!e#T#Z!e#o#p#Z~!hR!Q![!q!c!i!q#T#Z!q~!tR!Q![!}!c!i!}#T#Z!}~#QR!Q![!P!c!i!P#T#Z!P~#^R!Q![#g!c!i#g#T#Z#g~#jS!Q![#g!c!i#g#T#Z#g#q#r!P~#yP;=`<%l!P~$RO(c~~", 141, 340), new LocalTokenGroup("j~RQYZXz{^~^O(Q~~aP!P!Qd~iO(R~~", 25, 323)],
  topRules: {"Script":[0,7],"SingleExpression":[1,276],"SingleClassItem":[2,277]},
  dialects: {jsx: 0, ts: 15175},
  dynamicPrecedences: {"80":1,"82":1,"94":1,"169":1,"199":1},
  specialized: [{term: 327, get: (value) => spec_identifier[value] || -1},{term: 343, get: (value) => spec_word[value] || -1},{term: 95, get: (value) => spec_LessThan[value] || -1}],
  tokenPrec: 15201
});

/**
A collection of JavaScript-related
[snippets](https://codemirror.net/6/docs/ref/#autocomplete.snippet).
*/
const snippets = [
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("function ${name}(${params}) {\n\t${}\n}", {
        label: "function",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("for (let ${index} = 0; ${index} < ${bound}; ${index}++) {\n\t${}\n}", {
        label: "for",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("for (let ${name} of ${collection}) {\n\t${}\n}", {
        label: "for",
        detail: "of loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("do {\n\t${}\n} while (${})", {
        label: "do",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("while (${}) {\n\t${}\n}", {
        label: "while",
        detail: "loop",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("try {\n\t${}\n} catch (${error}) {\n\t${}\n}", {
        label: "try",
        detail: "/ catch block",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("if (${}) {\n\t${}\n}", {
        label: "if",
        detail: "block",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("if (${}) {\n\t${}\n} else {\n\t${}\n}", {
        label: "if",
        detail: "/ else block",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("class ${name} {\n\tconstructor(${params}) {\n\t\t${}\n\t}\n}", {
        label: "class",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("import {${names}} from \"${module}\"\n${}", {
        label: "import",
        detail: "named",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("import ${name} from \"${module}\"\n${}", {
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
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("interface ${name} {\n\t${}\n}", {
        label: "interface",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("type ${name} = ${type}", {
        label: "type",
        detail: "definition",
        type: "keyword"
    }),
    /*@__PURE__*/ext_CodeMirror_lib.snippetCompletion("enum ${name} {\n\t${}\n}", {
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
    let inner = ext_CodeMirror_lib.syntaxTree(context.state).resolveInner(context.pos, -1);
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
    let inner = ext_CodeMirror_lib.syntaxTree(context.state).resolveInner(context.pos, -1);
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
const javascriptLanguage = /*@__PURE__*/ext_CodeMirror_lib.LRLanguage.define({
    name: "javascript",
    parser: /*@__PURE__*/parser$4.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_lib.indentNodeProp.add({
                IfStatement: /*@__PURE__*/ext_CodeMirror_lib.continuedIndent({ except: /^\s*({|else\b)/ }),
                TryStatement: /*@__PURE__*/ext_CodeMirror_lib.continuedIndent({ except: /^\s*({|catch\b|finally\b)/ }),
                LabeledStatement: ext_CodeMirror_lib.flatIndent,
                SwitchBody: context => {
                    let after = context.textAfter, closed = /^\s*\}/.test(after), isCase = /^\s*(case|default)\b/.test(after);
                    return context.baseIndent + (closed ? 0 : isCase ? 1 : 2) * context.unit;
                },
                Block: /*@__PURE__*/ext_CodeMirror_lib.delimitedIndent({ closing: "}" }),
                ArrowFunction: cx => cx.baseIndent + cx.unit,
                "TemplateString BlockComment": () => null,
                "Statement Property": /*@__PURE__*/ext_CodeMirror_lib.continuedIndent({ except: /^{/ }),
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
            /*@__PURE__*/ext_CodeMirror_lib.foldNodeProp.add({
                "Block ClassBody SwitchBody EnumBody ObjectExpression ArrayExpression ObjectType": ext_CodeMirror_lib.foldInside,
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
    facet: /*@__PURE__*/ext_CodeMirror_lib.defineLanguageFacet({ commentTokens: { block: { open: "{/*", close: "*/}" } } })
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
    props: [/*@__PURE__*/ext_CodeMirror_lib.sublanguageProp.add(n => n.isTop ? [jsxSublanguage] : undefined)]
});
/**
Language provider for JSX + TypeScript.
*/
const tsxLanguage = /*@__PURE__*/javascriptLanguage.configure({
    dialect: "jsx ts",
    props: [/*@__PURE__*/ext_CodeMirror_lib.sublanguageProp.add(n => n.isTop ? [jsxSublanguage] : undefined)]
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
    return new ext_CodeMirror_lib.LanguageSupport(lang, [
        javascriptLanguage.data.of({
            autocomplete: ext_CodeMirror_lib.ifNotIn(dontComplete, ext_CodeMirror_lib.completeFromList(completions))
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
const autoCloseTags$1 = /*@__PURE__*/ext_CodeMirror_lib.EditorView.inputHandler.of((view, from, to, text, defaultInsert) => {
    if ((android ? view.composing : view.compositionStarted) || view.state.readOnly ||
        from != to || (text != ">" && text != "/") ||
        !javascriptLanguage.isActiveAt(view.state, from, -1))
        return false;
    let base = defaultInsert(), { state } = base;
    let closeTags = state.changeByRange(range => {
        var _a;
        let { head } = range, around = ext_CodeMirror_lib.syntaxTree(state).resolveInner(head - 1, -1), name;
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
                return { range: ext_CodeMirror_lib.EditorSelection.cursor(head + insert.length, -1), changes: { from: head, insert } };
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
const descendantOp = 107,
  Unit = 1,
  callee = 108,
  identifier$2 = 109,
  VariableName = 2,
  queryIdentifier = 110;

/* Hand-written tokenizers for CSS tokens that can't be
   expressed by Lezer's built-in tokenizer. */

const space = [9, 10, 11, 12, 13, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197,
               8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288];
const colon = 58, parenL = 40, underscore = 95, bracketL = 91, dash$1 = 45, period = 46,
      hash = 35, percent = 37, ampersand = 38, backslash = 92, newline = 10, asterisk = 42;

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
      if (inside) input.acceptToken(
        dashes == 2 && stack.canShift(VariableName) ? VariableName
          : stack.canShift(queryIdentifier) ? queryIdentifier
          : next == parenL ? callee
          : identifier$2);
      break
    }
  }
});

const descendant = new ExternalTokenizer(input => {
  if (space.includes(input.peek(-1))) {
    let {next} = input;
    if (isAlpha(next) || next == underscore || next == hash || next == period ||
        next == asterisk || next == bracketL || next == colon && isAlpha(input.peek(1)) ||
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

const cssHighlighting = ext_CodeMirror_lib.styleTags({
  "AtKeyword import charset namespace keyframes media supports": ext_CodeMirror_lib.tags.definitionKeyword,
  "from to selector": ext_CodeMirror_lib.tags.keyword,
  NamespaceName: ext_CodeMirror_lib.tags.namespace,
  KeyframeName: ext_CodeMirror_lib.tags.labelName,
  KeyframeRangeName: ext_CodeMirror_lib.tags.operatorKeyword,
  TagName: ext_CodeMirror_lib.tags.tagName,
  ClassName: ext_CodeMirror_lib.tags.className,
  PseudoClassName: ext_CodeMirror_lib.tags.constant(ext_CodeMirror_lib.tags.className),
  IdName: ext_CodeMirror_lib.tags.labelName,
  "FeatureName PropertyName": ext_CodeMirror_lib.tags.propertyName,
  AttributeName: ext_CodeMirror_lib.tags.attributeName,
  NumberLiteral: ext_CodeMirror_lib.tags.number,
  KeywordQuery: ext_CodeMirror_lib.tags.keyword,
  UnaryQueryOp: ext_CodeMirror_lib.tags.operatorKeyword,
  "CallTag ValueName": ext_CodeMirror_lib.tags.atom,
  VariableName: ext_CodeMirror_lib.tags.variableName,
  Callee: ext_CodeMirror_lib.tags.operatorKeyword,
  Unit: ext_CodeMirror_lib.tags.unit,
  "UniversalSelector NestingSelector": ext_CodeMirror_lib.tags.definitionOperator,
  "MatchOp CompareOp": ext_CodeMirror_lib.tags.compareOperator,
  "ChildOp SiblingOp, LogicOp": ext_CodeMirror_lib.tags.logicOperator,
  BinOp: ext_CodeMirror_lib.tags.arithmeticOperator,
  Important: ext_CodeMirror_lib.tags.modifier,
  Comment: ext_CodeMirror_lib.tags.blockComment,
  ColorLiteral: ext_CodeMirror_lib.tags.color,
  "ParenthesizedContent StringLiteral": ext_CodeMirror_lib.tags.string,
  ":": ext_CodeMirror_lib.tags.punctuation,
  "PseudoOp #": ext_CodeMirror_lib.tags.derefOperator,
  "; ,": ext_CodeMirror_lib.tags.separator,
  "( )": ext_CodeMirror_lib.tags.paren,
  "[ ]": ext_CodeMirror_lib.tags.squareBracket,
  "{ }": ext_CodeMirror_lib.tags.brace
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const spec_callee = {__proto__:null,lang:34, "nth-child":34, "nth-last-child":34, "nth-of-type":34, "nth-last-of-type":34, dir:34, "host-context":34, url:62, "url-prefix":62, domain:62, regexp:62};
const spec_AtKeyword = {__proto__:null,"@import":120, "@media":154, "@charset":158, "@namespace":162, "@keyframes":168, "@supports":180};
const spec_queryIdentifier = {__proto__:null,layer:124, not:144, only:144, selector:150};
const parser$3 = LRParser.deserialize({
  version: 14,
  states: ">`QYQ[OOO#kQ[OOP#rOWOOOOQP'#Cd'#CdOOQP'#Cc'#CcO#wQ[O'#CfO$hQXO'#CaO$rQ[O'#CiO$}Q[O'#DUO%SQ[O'#DXO%XQ[O'#D[O%XQ[O'#D_OOQP'#Ev'#EvO%yQdO'#DhO&hQ[O'#DzO%yQdO'#D|O&yQ[O'#EOO'UQ[O'#ERO'^Q[O'#EXO'lQ[O'#EZOOQS'#Eu'#EuOOQS'#E^'#E^QYQ[OOO'sQXO'#CdO(hQWO'#DdO(mQWO'#E{O(xQ[O'#E{QOQWOOP)SO#tO'#C_POOO)C@e)C@eOOQP'#Ch'#ChOOQP,59Q,59QO#wQ[O,59QO)_Q[O,59TO$}Q[O,59pO%SQ[O,59sO%XQ[O,59vO%XQ[O,59xO%XQ[O,59yO%XQ[O'#EcO)jQWO,58{O)rQ[O'#DcOOQS,58{,58{OOQP'#Cl'#ClOOQO'#DS'#DSOOQP,59T,59TO)yQWO,59TO*OQWO,59TOOQP'#DW'#DWOOQP,59p,59pOOQO'#DY'#DYO*TQ`O,59sO*nQXO,59vO+UQXO,59yOOQS'#Cq'#CqO%yQdO'#CrO+lQvO'#CtO-hQtO,5:SOOQO'#Cy'#CyO*OQWO'#CxO-rQWO'#CzO-wQ[O'#DPOOQS'#Ex'#ExOOQO'#Dn'#DnO.eQdO'#DwO.uQWO'#E|O'^Q[O'#DuO/TQWO'#DxOOQO'#E}'#E}O)mQWO,5:fO/YQpO,5:hOOQS'#EQ'#EQO/bQWO,5:jO/gQ[O,5:jOOQO'#ET'#ETO/oQWO,5:mO/tQWO,5:sO/|QWO,5:uOOQS-E8[-E8[O0UQdO,5:OO0fQ[O'#EeO0sQWO,5;gO0sQWO,5;gPOOO'#E]'#E]P1OO#tO,58yPOOO,58y,58yOOQP1G.l1G.lOOQP1G.o1G.oO)yQWO1G.oO*OQWO1G.oOOQP1G/[1G/[O1ZQ`O1G/_O1cQXO1G/bO1yQXO1G/dO2aQXO1G/eO2wQXO,5:}OOQO-E8a-E8aOOQS1G.g1G.gO3RQWO,59}O3WQ[O'#DTO3_QdO'#CpOOQP1G/_1G/_O%yQdO1G/_O3fQpO,59^OOQS,59`,59`O%yQdO,59bO3nQ[O'#DkO4PQWO1G/nO-VQ[O1G/nOOQS,59d,59dO4UQ!bO,59fOOQS'#DQ'#DQOOQS'#E`'#E`O4aQ[O,59kOOQS,59k,59kO4iQpO'#DnO4wQpO,5:ZO5PQWO,5:cOOQO'#FO'#FOO4zQpO,5:_O'^Q[O,5:]O5XQ[O'#EgO5pQWO,5;hO5{QWO,5:aO%XQ[O,5:dOOQS1G0Q1G0QOOQS1G0S1G0SOOQS1G0U1G0UO6^QWO1G0UO6cQdO'#EUOOQS1G0X1G0XOOQS1G0_1G0_OOQS1G0a1G0aO6nQtO1G/jOOQO1G/j1G/jOOQO,5;P,5;PO7UQ[O,5;POOQO-E8c-E8cO7cQWO1G1RPOOO-E8Z-E8ZPOOO1G.e1G.eOOQP7+$Z7+$ZOOQP7+$y7+$yO%yQdO7+$yOOQS1G/i1G/iO7nQXO'#EzO7xQWO,59oO7}QtO'#E_O8uQdO'#EwO9PQWO,59[O9UQpO7+$yOOQS1G.x1G.xOOQS1G.|1G.|O9^Q[O,5:VOOQS7+%Y7+%YO9cQWO7+%YOOQS1G/Q1G/QO9hQWO1G/QOOQS-E8^-E8^OOQS1G/V1G/VO%yQdO1G/uO9mQdO1G/yOOQO1G/}1G/}OOQO1G/w1G/wO9tQWO,5;ROOQO-E8e-E8eO:SQXO1G0OOOQS7+%p7+%pO:ZQYO'#CtOOQO'#EW'#EWO:iQ`O'#EVOOQO'#EV'#EVO:tQWO'#EhO:|QdO,5:pOOQS,5:p,5:pO;XQtO'#EdO%yQdO'#EdO<YQdO7+%UOOQO7+%U7+%UOOQO1G0k1G0kO<mQpO<<HeO<uQ[O'#EbO=PQWO,5;fOOQP1G/Z1G/ZOOQS-E8]-E8]O=XQdO'#EaO=cQWO,5;cOOQT1G.v1G.vOOQP<<He<<HeOOQO'#Dm'#DmO=kQWO1G/qOOQS<<Ht<<HtOOQS7+$l7+$lO=sQdO7+%aOOQO'#Dp'#DpO=zQpO7+%eOOQO7+%j7+%jOOQO,5:q,5:qO6fQdO'#EiO:tQWO,5;SOOQS,5;S,5;SOOQS-E8f-E8fOOQS1G0[1G0[O>SQtO,5;OOOQS-E8b-E8bOOQO<<Hp<<HpOOQPAN>PAN>PO?TQXO,5:|OOQO-E8`-E8`O?_QdO,5:{OOQO-E8_-E8_O9^Q[O'#EfO?iQWO7+%]OOQS7+%]7+%]OOQO<<H{<<H{OOQO<<IP<<IPO?qQdO<<IPOOQO,5;T,5;TOOQO-E8g-E8gOOQS1G0n1G0nOOQO,5;Q,5;QOOQO-E8d-E8dOOQS<<Hw<<HwO@YQWOAN>kOOQOG24VG24V",
  stateData: "@g~O#dOS#eQQ~OU[OX[OZTO^VO_VOrXOyWO!PYO!SZO!]cO!^]O!o^O!q_O!s`O!vaO!|bO#aRO~OQhOU[OX[OZTO^VO_VOrXOyWO!PYO!SZO!]cO!^]O!o^O!q_O!s`O!vaO!|bO#agO~O#^#oP~P!aO#elO~O#anO~OZpO^qO_qOrsOyrO!PtO!SvO#_uO~OuwO!UyO~P#|Oa!PO#`|O#a{O~O#a!QO~O#a!SO~OU[OX[OZTO^VO_VOrXOyWO!PYO!SZO#aRO~OQ!`Oc!XOg!`Oi!`Oo!^Or!_O#`![O#a!WO#m!YO~Oc!bO!j!dO!m!eO#b!aO!U#pP~Oi!jOo!^O#a!iO~Oi!lO#a!lO~Oc!bO!j!dO!m!eO#b!aO~O!Z#pP~P&hOZWX^WX^!XX_WXrWXuWXyWX!PWX!SWX!UWX#_WX~O^!qO~O!Z!rO#^#oX!T#oX~O#^#oX!T#oX~P!aO#f!uO#g!uO#h!wO~Oa!{O#`|O#a{O~OuwO!UyO~O!T#oP~P!aOc#VO~Oc#WO~Oq#XO}#YO~OZpO^qO_qOrsOyrO~Ou!Oa!P!Oa!S!Oa!U!Oa#_!Oab!Oa~P*]Ou!Ra!P!Ra!S!Ra!U!Ra#_!Rab!Ra~P*]OP#[OchXkhX!ZhX!`hX!jhX!mhX#bhXbhX!hhXQhXghXihXohXrhXuhX!YhX#^hX#`hX#ahX#mhXqhX!ThX~Oc!bO!j!dO!m!eO#b!aO!Z#pP~Ok#]O!`#^O~P-VOc#bO~Oq#fO#a#cO~OQ#jOg#jOi#jOo!^O#`![O#m!YO~Oc!bO!j!dO!m!eO#b#gO~P.POu#mO!f#lO!U#pX!Z#pX~Oc#pO~Ok#]O!Z#rO~O!Z#sO~Oi#tOo!^O~O!U#uO~O!UyO!f#lO~O!UyO!Z#xO~O!Y#zO!Z!Wa#^!Wa!T!Wa~P%yO!Z#XX#^#XX!T#XX~P!aO!Z!rO#^#oa!T#oa~O#f!uO#g!uO#h$QO~Oq$SO}$TO~Ou!Oi!P!Oi!S!Oi!U!Oi#_!Oib!Oi~P*]Ou!Qi!P!Qi!S!Qi!U!Qi#_!Qib!Qi~P*]Ou!Ri!P!Ri!S!Ri!U!Ri#_!Rib!Ri~P*]Ou#Va!U#Va~P#|O!T$UO~Ob#nP~P%XOb#kP~P%yOb$]Ok#]O~Oc$_O!Z!_X!j!_X!m!_X#b!_X~O!Z$`O~Ob$bOi$cOp$cO~Oq$eO#a#cO~O^!dXb!bX!f!bX!h!dX~O^$fO!h$gO~Ob$hO!f#lO~Oc!bO!j!dO!m!eO#b!aOu#ZX!U#ZX!Z#ZX~Ou#mO!U#pa!Z#pa~O!f#lOu!ia!U!ia!Z!iab!ia~O!Z$mO~O!T$tO#a$oO#m$nO~Ok#]Ou$vO!Y$xO!Z!Wi#^!Wi!T!Wi~P%yO!Z#Xa#^#Xa!T#Xa~P!aO!Z!rO#^#oi!T#oi~Ou${Ob#nX~P#|Ob$}O~Ok#]OQ#RXb#RXc#RXg#RXi#RXo#RXr#RXu#RX#`#RX#a#RX#m#RX~Ou%POb#kX~P%yOb%RO~Ok#]Oq%SO~O#a%TO~O!Z%VO~Ob%WO~O#b%YO~P.PO!f#lOu#Za!U#Za!Z#Za~Ob%[O~P#|OP#[OuhX!UhXbhX~O#m$nOu!yX!U!yX~Ou%^O!UyO~O!T%bO#a$oO#m$nO~Ok#]OQ#WXc#WXg#WXi#WXo#WXr#WXu#WX!Y#WX!Z#WX#^#WX#`#WX#a#WX#m#WX!T#WX~Ou$vO!Y%eO!Z!Wq#^!Wq!T!Wq~P%yOk#]Oq%fO~Ob#UXu#UX~P%XOu${Ob#na~Ob#TXu#TX~P%yOu%POb#ka~OZ%kOb%mO~Ob%nO~P%yOb%oO!h%pO~Ok#]OQ#Wac#Wag#Wai#Wao#War#Wau#Wa!Y#Wa!Z#Wa#^#Wa#`#Wa#a#Wa#m#Wa!T#Wa~Ob#Uau#Ua~P#|Ob#Tau#Ta~P%yOZ%kOb%vO~OQ#jOg#jOi#jOo!^O#`![O#b%YO#m$nO~Ob%xO~O#dp#e#mk!S#m~",
  goto: "/l#sPPP#tP#wP$Q$dP$QP$v$QPP$|PPP%S%]%]P%oP%]P&`&w'^PPPP%]'{P(P(V$QP(]$Q(cP$QP$Q$QPPP(i)O)]PP#wPP)dP)g)m)m)x)mP)mP)mP)m)mP#wP#wP#wP*R#wP*U*X*[*c#wP#wP*h*n*}+]+c+i+o+u+{,V,],c,iPPPPPPPPPPP,o,x-n-qP.g.j.p.|/cRmQ_dOPfjy!r#|q[OPYZfjtuvwy!r#V#p#|${qSOPYZfjtuvwy!r#V#p#|${QoTR!xpQ}VR!yqQ!y!PQ#a!]R$R!{q!`]_!X!q#W#Y#]#y$T$Y$f$v$w%P%X%ip!`]_!X!q#W#Y#]#y$T$Y$f$v$w%P%X%iU#j!b$g%pU$q#u$s%^R%]$pp!`]_!X!q#W#Y#]#y$T$Y$f$v$w%P%X%iV#j!b$g%pw!]]_!X!b!q#W#Y#]#y$T$Y$f$g$v$w%P%X%i%pp!`]_!X!q#W#Y#]#y$T$Y$f$v$w%P%X%iQ!j`U#j!b$g%pR#t!kT#d!_#eQ!OVR!zqQ!y!OR$R!zQ!RWR!|rQ!TXR!}sQzUQ#TxQ#q!gQ#w!nQ#x!oQ%`$rR%s%_SiPyQ!tjQ#{!rR$y#|ZhPjy!r#|R#`!ZQ%U$_R%t%kc!f^bc!Z!b!d#`#l#mQ#h!bQ%Z$gR%w%pR!k`R!maR#v!mS$r#u$sR%q%^V$p#u$s%^Q!vlR$P!vQfOSjPyU!pfj#|R#|!rQ$Y#WU%O$Y%X%iQ%X$fR%i%PQ#e!_R$d#eQ%Q$YR%j%QQ$|$VR%h$|QxUR#SxQ$w#yR%d$wQ!siS#}!s$OR$O!tQ%l%UR%u%lQ#n!cR$k#nQ$s#uR%a$sQ%_$rR%r%__eOPfjy!r#|^UOPfjy!r#|Q!UYQ!VZQ#OtQ#PuQ#QvQ#RwQ$V#VQ$l#pR%g${R$Z#WQ!Z]Q!h_Q#Z!XQ#y!q[$X#W$Y$f%P%X%iQ$[#YQ$^#]S$u#y$wQ$z$TR%c$vR$W#VQkPR#UyQ!g^Q!ocQ#_!ZR$a#`W!c^c!Z#`Q!nbQ#i!bQ#o!dQ$i#lR$j#mQ#k!bQ%Z$gR%w%p",
  nodeNames: "⚠ Unit VariableName Comment StyleSheet RuleSet UniversalSelector TagSelector TagName NestingSelector ClassSelector . ClassName PseudoClassSelector : :: PseudoClassName PseudoClassName ) ( ArgList ValueName ParenthesizedValue ColorLiteral NumberLiteral StringLiteral BinaryExpression BinOp CallExpression Callee CallLiteral CallTag ParenthesizedContent ] [ LineNames LineName , PseudoClassName ArgList IdSelector # IdName AttributeSelector AttributeName MatchOp ChildSelector ChildOp DescendantSelector SiblingSelector SiblingOp } { Block Declaration PropertyName Important ; ImportStatement AtKeyword import Layer layer LayerName KeywordQuery FeatureQuery FeatureName BinaryQuery LogicOp ComparisonQuery CompareOp UnaryQuery UnaryQueryOp ParenthesizedQuery SelectorQuery selector MediaStatement media CharsetStatement charset NamespaceStatement namespace NamespaceName KeyframesStatement keyframes KeyframeName KeyframeList KeyframeSelector KeyframeRangeName SupportsStatement supports AtRule Styles",
  maxTerm: 126,
  nodeProps: [
    ["isolate", -2,3,25,""],
    ["openedBy", 18,"(",33,"[",51,"{"],
    ["closedBy", 19,")",34,"]",52,"}"]
  ],
  propSources: [cssHighlighting],
  skippedNodes: [0,3,93],
  repeatNodeCount: 13,
  tokenData: "LU~R!^OX$}X^%u^p$}pq%uqr)Xrs.Rst/utu6duv$}vw7^wx7oxy9^yz9oz{9t{|:_|}?Q}!O?c!O!P@Q!P!Q@i!Q![Ab![!]B]!]!^CX!^!_Cj!_!`Df!`!aDy!a!b$}!b!cEz!c!}$}!}#OHX#O#P$}#P#QHj#Q#R6d#R#T$}#T#UH{#U#c$}#c#dJ^#d#o$}#o#pJs#p#q6d#q#rKU#r#sKg#s#y$}#y#z%u#z$f$}$f$g%u$g#BY$}#BY#BZ%u#BZ$IS$}$IS$I_%u$I_$I|$}$I|$JO%u$JO$JT$}$JT$JU%u$JU$KV$}$KV$KW%u$KW&FU$}&FU&FV%u&FV;'S$};'S;=`LO<%lO$}`%QSOy%^z;'S%^;'S;=`%o<%lO%^`%cSp`Oy%^z;'S%^;'S;=`%o<%lO%^`%rP;=`<%l%^~%zh#d~OX%^X^'f^p%^pq'fqy%^z#y%^#y#z'f#z$f%^$f$g'f$g#BY%^#BY#BZ'f#BZ$IS%^$IS$I_'f$I_$I|%^$I|$JO'f$JO$JT%^$JT$JU'f$JU$KV%^$KV$KW'f$KW&FU%^&FU&FV'f&FV;'S%^;'S;=`%o<%lO%^~'mh#d~p`OX%^X^'f^p%^pq'fqy%^z#y%^#y#z'f#z$f%^$f$g'f$g#BY%^#BY#BZ'f#BZ$IS%^$IS$I_'f$I_$I|%^$I|$JO'f$JO$JT%^$JT$JU'f$JU$KV%^$KV$KW'f$KW&FU%^&FU&FV'f&FV;'S%^;'S;=`%o<%lO%^l)[UOy%^z#]%^#]#^)n#^;'S%^;'S;=`%o<%lO%^l)sUp`Oy%^z#a%^#a#b*V#b;'S%^;'S;=`%o<%lO%^l*[Up`Oy%^z#d%^#d#e*n#e;'S%^;'S;=`%o<%lO%^l*sUp`Oy%^z#c%^#c#d+V#d;'S%^;'S;=`%o<%lO%^l+[Up`Oy%^z#f%^#f#g+n#g;'S%^;'S;=`%o<%lO%^l+sUp`Oy%^z#h%^#h#i,V#i;'S%^;'S;=`%o<%lO%^l,[Up`Oy%^z#T%^#T#U,n#U;'S%^;'S;=`%o<%lO%^l,sUp`Oy%^z#b%^#b#c-V#c;'S%^;'S;=`%o<%lO%^l-[Up`Oy%^z#h%^#h#i-n#i;'S%^;'S;=`%o<%lO%^l-uS!Y[p`Oy%^z;'S%^;'S;=`%o<%lO%^~.UWOY.RZr.Rrs.ns#O.R#O#P.s#P;'S.R;'S;=`/o<%lO.R~.sOi~~.vRO;'S.R;'S;=`/P;=`O.R~/SXOY.RZr.Rrs.ns#O.R#O#P.s#P;'S.R;'S;=`/o;=`<%l.R<%lO.R~/rP;=`<%l.Rn/zYyQOy%^z!Q%^!Q![0j![!c%^!c!i0j!i#T%^#T#Z0j#Z;'S%^;'S;=`%o<%lO%^l0oYp`Oy%^z!Q%^!Q![1_![!c%^!c!i1_!i#T%^#T#Z1_#Z;'S%^;'S;=`%o<%lO%^l1dYp`Oy%^z!Q%^!Q![2S![!c%^!c!i2S!i#T%^#T#Z2S#Z;'S%^;'S;=`%o<%lO%^l2ZYg[p`Oy%^z!Q%^!Q![2y![!c%^!c!i2y!i#T%^#T#Z2y#Z;'S%^;'S;=`%o<%lO%^l3QYg[p`Oy%^z!Q%^!Q![3p![!c%^!c!i3p!i#T%^#T#Z3p#Z;'S%^;'S;=`%o<%lO%^l3uYp`Oy%^z!Q%^!Q![4e![!c%^!c!i4e!i#T%^#T#Z4e#Z;'S%^;'S;=`%o<%lO%^l4lYg[p`Oy%^z!Q%^!Q![5[![!c%^!c!i5[!i#T%^#T#Z5[#Z;'S%^;'S;=`%o<%lO%^l5aYp`Oy%^z!Q%^!Q![6P![!c%^!c!i6P!i#T%^#T#Z6P#Z;'S%^;'S;=`%o<%lO%^l6WSg[p`Oy%^z;'S%^;'S;=`%o<%lO%^d6gUOy%^z!_%^!_!`6y!`;'S%^;'S;=`%o<%lO%^d7QS}Sp`Oy%^z;'S%^;'S;=`%o<%lO%^b7cSXQOy%^z;'S%^;'S;=`%o<%lO%^~7rWOY7oZw7owx.nx#O7o#O#P8[#P;'S7o;'S;=`9W<%lO7o~8_RO;'S7o;'S;=`8h;=`O7o~8kXOY7oZw7owx.nx#O7o#O#P8[#P;'S7o;'S;=`9W;=`<%l7o<%lO7o~9ZP;=`<%l7on9cSc^Oy%^z;'S%^;'S;=`%o<%lO%^~9tOb~n9{UUQkWOy%^z!_%^!_!`6y!`;'S%^;'S;=`%o<%lO%^n:fWkW!SQOy%^z!O%^!O!P;O!P!Q%^!Q![>T![;'S%^;'S;=`%o<%lO%^l;TUp`Oy%^z!Q%^!Q![;g![;'S%^;'S;=`%o<%lO%^l;nYp`#m[Oy%^z!Q%^!Q![;g![!g%^!g!h<^!h#X%^#X#Y<^#Y;'S%^;'S;=`%o<%lO%^l<cYp`Oy%^z{%^{|=R|}%^}!O=R!O!Q%^!Q![=j![;'S%^;'S;=`%o<%lO%^l=WUp`Oy%^z!Q%^!Q![=j![;'S%^;'S;=`%o<%lO%^l=qUp`#m[Oy%^z!Q%^!Q![=j![;'S%^;'S;=`%o<%lO%^l>[[p`#m[Oy%^z!O%^!O!P;g!P!Q%^!Q![>T![!g%^!g!h<^!h#X%^#X#Y<^#Y;'S%^;'S;=`%o<%lO%^n?VSu^Oy%^z;'S%^;'S;=`%o<%lO%^l?hWkWOy%^z!O%^!O!P;O!P!Q%^!Q![>T![;'S%^;'S;=`%o<%lO%^n@VUZQOy%^z!Q%^!Q![;g![;'S%^;'S;=`%o<%lO%^~@nTkWOy%^z{@}{;'S%^;'S;=`%o<%lO%^~AUSp`#e~Oy%^z;'S%^;'S;=`%o<%lO%^lAg[#m[Oy%^z!O%^!O!P;g!P!Q%^!Q![>T![!g%^!g!h<^!h#X%^#X#Y<^#Y;'S%^;'S;=`%o<%lO%^jBbU^YOy%^z![%^![!]Bt!];'S%^;'S;=`%o<%lO%^bB{S_Qp`Oy%^z;'S%^;'S;=`%o<%lO%^nC^S!Z^Oy%^z;'S%^;'S;=`%o<%lO%^hCoU!hWOy%^z!_%^!_!`DR!`;'S%^;'S;=`%o<%lO%^hDYS!hWp`Oy%^z;'S%^;'S;=`%o<%lO%^lDmS!hW}SOy%^z;'S%^;'S;=`%o<%lO%^jEQV!PQ!hWOy%^z!_%^!_!`DR!`!aEg!a;'S%^;'S;=`%o<%lO%^bEnS!PQp`Oy%^z;'S%^;'S;=`%o<%lO%^bE}YOy%^z}%^}!OFm!O!c%^!c!}G[!}#T%^#T#oG[#o;'S%^;'S;=`%o<%lO%^bFrWp`Oy%^z!c%^!c!}G[!}#T%^#T#oG[#o;'S%^;'S;=`%o<%lO%^bGc[!]Qp`Oy%^z}%^}!OG[!O!Q%^!Q![G[![!c%^!c!}G[!}#T%^#T#oG[#o;'S%^;'S;=`%o<%lO%^nH^Sr^Oy%^z;'S%^;'S;=`%o<%lO%^nHoSq^Oy%^z;'S%^;'S;=`%o<%lO%^jIOUOy%^z#b%^#b#cIb#c;'S%^;'S;=`%o<%lO%^jIgUp`Oy%^z#W%^#W#XIy#X;'S%^;'S;=`%o<%lO%^jJQS!fYp`Oy%^z;'S%^;'S;=`%o<%lO%^jJaUOy%^z#f%^#f#gIy#g;'S%^;'S;=`%o<%lO%^fJxS!UUOy%^z;'S%^;'S;=`%o<%lO%^nKZS!T^Oy%^z;'S%^;'S;=`%o<%lO%^fKlU!SQOy%^z!_%^!_!`6y!`;'S%^;'S;=`%o<%lO%^`LRP;=`<%l$}",
  tokenizers: [descendant, unitToken, identifiers, 1, 2, 3, 4, new LocalTokenGroup("m~RRYZ[z{a~~g~aO#g~~dP!P!Qg~lO#h~~", 28, 114)],
  topRules: {"StyleSheet":[0,4],"Styles":[1,92]},
  specialized: [{term: 108, get: (value) => spec_callee[value] || -1},{term: 59, get: (value) => spec_AtKeyword[value] || -1},{term: 110, get: (value) => spec_queryIdentifier[value] || -1}],
  tokenPrec: 1441
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
    let { state, pos } = context, node = ext_CodeMirror_lib.syntaxTree(state).resolveInner(pos, -1);
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
const cssLanguage = /*@__PURE__*/ext_CodeMirror_lib.LRLanguage.define({
    name: "css",
    parser: /*@__PURE__*/parser$3.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_lib.indentNodeProp.add({
                Declaration: /*@__PURE__*/ext_CodeMirror_lib.continuedIndent()
            }),
            /*@__PURE__*/ext_CodeMirror_lib.foldNodeProp.add({
                "Block KeyframeList": ext_CodeMirror_lib.foldInside
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
    return new ext_CodeMirror_lib.LanguageSupport(cssLanguage, cssLanguage.data.of({ autocomplete: cssCompletionSource }));
}

const jsonHighlighting = ext_CodeMirror_lib.styleTags({
  String: ext_CodeMirror_lib.tags.string,
  Number: ext_CodeMirror_lib.tags.number,
  "True False": ext_CodeMirror_lib.tags.bool,
  PropertyName: ext_CodeMirror_lib.tags.propertyName,
  Null: ext_CodeMirror_lib.tags.null,
  ", :": ext_CodeMirror_lib.tags.separator,
  "[ ]": ext_CodeMirror_lib.tags.squareBracket,
  "{ }": ext_CodeMirror_lib.tags.brace
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
const jsonLanguage = /*@__PURE__*/ext_CodeMirror_lib.LRLanguage.define({
    name: "json",
    parser: /*@__PURE__*/parser$2.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_lib.indentNodeProp.add({
                Object: /*@__PURE__*/ext_CodeMirror_lib.continuedIndent({ except: /^\s*\}/ }),
                Array: /*@__PURE__*/ext_CodeMirror_lib.continuedIndent({ except: /^\s*\]/ })
            }),
            /*@__PURE__*/ext_CodeMirror_lib.foldNodeProp.add({
                "Object Array": ext_CodeMirror_lib.foldInside
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
    return new ext_CodeMirror_lib.LanguageSupport(jsonLanguage);
}

// This file was generated by lezer-generator. You probably shouldn't edit it.
const scriptText = 55,
  StartCloseScriptTag = 1,
  styleText = 56,
  StartCloseStyleTag = 2,
  textareaText = 57,
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
  missingCloseTag = 58,
  IncompleteTag = 14,
  IncompleteCloseTag = 15,
  commentContent$1 = 59,
  Element = 21,
  TagName = 23,
  Attribute = 24,
  AttributeName = 25,
  AttributeValue = 27,
  UnquotedAttributeValue = 28,
  ScriptText = 29,
  StyleText = 32,
  TextareaText = 35,
  OpenTag = 37,
  CloseTag = 38,
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

let cachedName = null, cachedInput = null, cachedPos = 0;
function tagNameAfter(input, offset) {
  let pos = input.pos + offset;
  if (cachedPos == pos && cachedInput == input) return cachedName
  let next = input.peek(offset), name = "";
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
  if (!name) return input.acceptToken(close ? IncompleteCloseTag : IncompleteTag)

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
    // - 2 '</'
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

const htmlHighlighting = ext_CodeMirror_lib.styleTags({
  "Text RawText IncompleteTag IncompleteCloseTag": ext_CodeMirror_lib.tags.content,
  "StartTag StartCloseTag SelfClosingEndTag EndTag": ext_CodeMirror_lib.tags.angleBracket,
  TagName: ext_CodeMirror_lib.tags.tagName,
  "MismatchedCloseTag/TagName": [ext_CodeMirror_lib.tags.tagName,  ext_CodeMirror_lib.tags.invalid],
  AttributeName: ext_CodeMirror_lib.tags.attributeName,
  "AttributeValue UnquotedAttributeValue": ext_CodeMirror_lib.tags.attributeValue,
  Is: ext_CodeMirror_lib.tags.definitionOperator,
  "EntityReference CharacterReference": ext_CodeMirror_lib.tags.character,
  Comment: ext_CodeMirror_lib.tags.blockComment,
  ProcessingInst: ext_CodeMirror_lib.tags.processingInstruction,
  DoctypeDecl: ext_CodeMirror_lib.tags.documentMeta
});

// This file was generated by lezer-generator. You probably shouldn't edit it.
const parser$1 = LRParser.deserialize({
  version: 14,
  states: ",xOVO!rOOO!ZQ#tO'#CrO!`Q#tO'#C{O!eQ#tO'#DOO!jQ#tO'#DRO!oQ#tO'#DTO!tOaO'#CqO#PObO'#CqO#[OdO'#CqO$kO!rO'#CqOOO`'#Cq'#CqO$rO$fO'#DUO$zQ#tO'#DWO%PQ#tO'#DXOOO`'#Dl'#DlOOO`'#DZ'#DZQVO!rOOO%UQ&rO,59^O%aQ&rO,59gO%lQ&rO,59jO%wQ&rO,59mO&SQ&rO,59oOOOa'#D_'#D_O&_OaO'#CyO&jOaO,59]OOOb'#D`'#D`O&rObO'#C|O&}ObO,59]OOOd'#Da'#DaO'VOdO'#DPO'bOdO,59]OOO`'#Db'#DbO'jO!rO,59]O'qQ#tO'#DSOOO`,59],59]OOOp'#Dc'#DcO'vO$fO,59pOOO`,59p,59pO(OQ#|O,59rO(TQ#|O,59sOOO`-E7X-E7XO(YQ&rO'#CtOOQW'#D['#D[O(hQ&rO1G.xOOOa1G.x1G.xOOO`1G/Z1G/ZO(sQ&rO1G/ROOOb1G/R1G/RO)OQ&rO1G/UOOOd1G/U1G/UO)ZQ&rO1G/XOOO`1G/X1G/XO)fQ&rO1G/ZOOOa-E7]-E7]O)qQ#tO'#CzOOO`1G.w1G.wOOOb-E7^-E7^O)vQ#tO'#C}OOOd-E7_-E7_O){Q#tO'#DQOOO`-E7`-E7`O*QQ#|O,59nOOOp-E7a-E7aOOO`1G/[1G/[OOO`1G/^1G/^OOO`1G/_1G/_O*VQ,UO,59`OOQW-E7Y-E7YOOOa7+$d7+$dOOO`7+$u7+$uOOOb7+$m7+$mOOOd7+$p7+$pOOO`7+$s7+$sO*bQ#|O,59fO*gQ#|O,59iO*lQ#|O,59lOOO`1G/Y1G/YO*qO7[O'#CwO+SOMhO'#CwOOQW1G.z1G.zOOO`1G/Q1G/QOOO`1G/T1G/TOOO`1G/W1G/WOOOO'#D]'#D]O+eO7[O,59cOOQW,59c,59cOOOO'#D^'#D^O+vOMhO,59cOOOO-E7Z-E7ZOOQW1G.}1G.}OOOO-E7[-E7[",
  stateData: ",c~O!_OS~OUSOVPOWQOXROYTO[]O][O^^O_^Oa^Ob^Oc^Od^Oy^O|_O!eZO~OgaO~OgbO~OgcO~OgdO~OgeO~O!XfOPmP![mP~O!YiOQpP![pP~O!ZlORsP![sP~OUSOVPOWQOXROYTOZqO[]O][O^^O_^Oa^Ob^Oc^Od^Oy^O!eZO~O![rO~P#gO!]sO!fuO~OgvO~OgwO~OS|OT}OiyO~OS!POT}OiyO~OS!ROT}OiyO~OS!TOT}OiyO~OS}OT}OiyO~O!XfOPmX![mX~OP!WO![!XO~O!YiOQpX![pX~OQ!ZO![!XO~O!ZlORsX![sX~OR!]O![!XO~O![!XO~P#gOg!_O~O!]sO!f!aO~OS!bO~OS!cO~Oj!dOShXThXihX~OS!fOT!gOiyO~OS!hOT!gOiyO~OS!iOT!gOiyO~OS!jOT!gOiyO~OS!gOT!gOiyO~Og!kO~Og!lO~Og!mO~OS!nO~Ol!qO!a!oO!c!pO~OS!rO~OS!sO~OS!tO~Ob!uOc!uOd!uO!a!wO!b!uO~Ob!xOc!xOd!xO!c!wO!d!xO~Ob!uOc!uOd!uO!a!{O!b!uO~Ob!xOc!xOd!xO!c!{O!d!xO~OT~cbd!ey|!e~",
  goto: "%q!aPPPPPPPPPPPPPPPPPPPPP!b!hP!nPP!zP!}#Q#T#Z#^#a#g#j#m#s#y!bP!b!bP$P$V$m$s$y%P%V%]%cPPPPPPPP%iX^OX`pXUOX`pezabcde{!O!Q!S!UR!q!dRhUR!XhXVOX`pRkVR!XkXWOX`pRnWR!XnXXOX`pQrXR!XpXYOX`pQ`ORx`Q{aQ!ObQ!QcQ!SdQ!UeZ!e{!O!Q!S!UQ!v!oR!z!vQ!y!pR!|!yQgUR!VgQjVR!YjQmWR![mQpXR!^pQtZR!`tS_O`ToXp",
  nodeNames: "⚠ StartCloseTag StartCloseTag StartCloseTag EndTag SelfClosingEndTag StartTag StartTag StartTag StartTag StartTag StartCloseTag StartCloseTag StartCloseTag IncompleteTag IncompleteCloseTag Document Text EntityReference CharacterReference InvalidEntity Element OpenTag TagName Attribute AttributeName Is AttributeValue UnquotedAttributeValue ScriptText CloseTag OpenTag StyleText CloseTag OpenTag TextareaText CloseTag OpenTag CloseTag SelfClosingTag Comment ProcessingInst MismatchedCloseTag CloseTag DoctypeDecl",
  maxTerm: 68,
  context: elementContext,
  nodeProps: [
    ["closedBy", -10,1,2,3,7,8,9,10,11,12,13,"EndTag",6,"EndTag SelfClosingEndTag",-4,22,31,34,37,"CloseTag"],
    ["openedBy", 4,"StartTag StartCloseTag",5,"StartTag",-4,30,33,36,38,"OpenTag"],
    ["group", -10,14,15,18,19,20,21,40,41,42,43,"Entity",17,"Entity TextContent",-3,29,32,35,"TextContent Entity"],
    ["isolate", -11,22,30,31,33,34,36,37,38,39,42,43,"ltr",-3,27,28,40,""]
  ],
  propSources: [htmlHighlighting],
  skippedNodes: [0],
  repeatNodeCount: 9,
  tokenData: "!<p!aR!YOX$qXY,QYZ,QZ[$q[]&X]^,Q^p$qpq,Qqr-_rs3_sv-_vw3}wxHYx}-_}!OH{!O!P-_!P!Q$q!Q![-_![!]Mz!]!^-_!^!_!$S!_!`!;x!`!a&X!a!c-_!c!}Mz!}#R-_#R#SMz#S#T1k#T#oMz#o#s-_#s$f$q$f%W-_%W%oMz%o%p-_%p&aMz&a&b-_&b1pMz1p4U-_4U4dMz4d4e-_4e$ISMz$IS$I`-_$I`$IbMz$Ib$Kh-_$Kh%#tMz%#t&/x-_&/x&EtMz&Et&FV-_&FV;'SMz;'S;:j!#|;:j;=`3X<%l?&r-_?&r?AhMz?Ah?BY$q?BY?MnMz?MnO$q!Z$|caPlW!b`!dpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr$qrs&}sv$qvw+Pwx(tx!^$q!^!_*V!_!a&X!a#S$q#S#T&X#T;'S$q;'S;=`+z<%lO$q!R&bXaP!b`!dpOr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&Xq'UVaP!dpOv&}wx'kx!^&}!^!_(V!_;'S&};'S;=`(n<%lO&}P'pTaPOv'kw!^'k!_;'S'k;'S;=`(P<%lO'kP(SP;=`<%l'kp([S!dpOv(Vx;'S(V;'S;=`(h<%lO(Vp(kP;=`<%l(Vq(qP;=`<%l&}a({WaP!b`Or(trs'ksv(tw!^(t!^!_)e!_;'S(t;'S;=`*P<%lO(t`)jT!b`Or)esv)ew;'S)e;'S;=`)y<%lO)e`)|P;=`<%l)ea*SP;=`<%l(t!Q*^V!b`!dpOr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!Q*vP;=`<%l*V!R*|P;=`<%l&XW+UYlWOX+PZ[+P^p+Pqr+Psw+Px!^+P!a#S+P#T;'S+P;'S;=`+t<%lO+PW+wP;=`<%l+P!Z+}P;=`<%l$q!a,]`aP!b`!dp!_^OX&XXY,QYZ,QZ]&X]^,Q^p&Xpq,Qqr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&X!_-ljiSaPlW!b`!dpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx!P-_!P!Q$q!Q!^-_!^!_*V!_!a&X!a#S-_#S#T1k#T#s-_#s$f$q$f;'S-_;'S;=`3X<%l?Ah-_?Ah?BY$q?BY?Mn-_?MnO$q[/ebiSlWOX+PZ[+P^p+Pqr/^sw/^x!P/^!P!Q+P!Q!^/^!a#S/^#S#T0m#T#s/^#s$f+P$f;'S/^;'S;=`1e<%l?Ah/^?Ah?BY+P?BY?Mn/^?MnO+PS0rXiSqr0msw0mx!P0m!Q!^0m!a#s0m$f;'S0m;'S;=`1_<%l?Ah0m?BY?Mn0mS1bP;=`<%l0m[1hP;=`<%l/^!V1vciSaP!b`!dpOq&Xqr1krs&}sv1kvw0mwx(tx!P1k!P!Q&X!Q!^1k!^!_*V!_!a&X!a#s1k#s$f&X$f;'S1k;'S;=`3R<%l?Ah1k?Ah?BY&X?BY?Mn1k?MnO&X!V3UP;=`<%l1k!_3[P;=`<%l-_!Z3hV!ahaP!dpOv&}wx'kx!^&}!^!_(V!_;'S&};'S;=`(n<%lO&}!_4WiiSlWd!ROX5uXZ7SZ[5u[^7S^p5uqr8trs7Sst>]tw8twx7Sx!P8t!P!Q5u!Q!]8t!]!^/^!^!a7S!a#S8t#S#T;{#T#s8t#s$f5u$f;'S8t;'S;=`>V<%l?Ah8t?Ah?BY5u?BY?Mn8t?MnO5u!Z5zblWOX5uXZ7SZ[5u[^7S^p5uqr5urs7Sst+Ptw5uwx7Sx!]5u!]!^7w!^!a7S!a#S5u#S#T7S#T;'S5u;'S;=`8n<%lO5u!R7VVOp7Sqs7St!]7S!]!^7l!^;'S7S;'S;=`7q<%lO7S!R7qOb!R!R7tP;=`<%l7S!Z8OYlWb!ROX+PZ[+P^p+Pqr+Psw+Px!^+P!a#S+P#T;'S+P;'S;=`+t<%lO+P!Z8qP;=`<%l5u!_8{iiSlWOX5uXZ7SZ[5u[^7S^p5uqr8trs7Sst/^tw8twx7Sx!P8t!P!Q5u!Q!]8t!]!^:j!^!a7S!a#S8t#S#T;{#T#s8t#s$f5u$f;'S8t;'S;=`>V<%l?Ah8t?Ah?BY5u?BY?Mn8t?MnO5u!_:sbiSlWb!ROX+PZ[+P^p+Pqr/^sw/^x!P/^!P!Q+P!Q!^/^!a#S/^#S#T0m#T#s/^#s$f+P$f;'S/^;'S;=`1e<%l?Ah/^?Ah?BY+P?BY?Mn/^?MnO+P!V<QciSOp7Sqr;{rs7Sst0mtw;{wx7Sx!P;{!P!Q7S!Q!];{!]!^=]!^!a7S!a#s;{#s$f7S$f;'S;{;'S;=`>P<%l?Ah;{?Ah?BY7S?BY?Mn;{?MnO7S!V=dXiSb!Rqr0msw0mx!P0m!Q!^0m!a#s0m$f;'S0m;'S;=`1_<%l?Ah0m?BY?Mn0m!V>SP;=`<%l;{!_>YP;=`<%l8t!_>dhiSlWOX@OXZAYZ[@O[^AY^p@OqrBwrsAYswBwwxAYx!PBw!P!Q@O!Q!]Bw!]!^/^!^!aAY!a#SBw#S#TE{#T#sBw#s$f@O$f;'SBw;'S;=`HS<%l?AhBw?Ah?BY@O?BY?MnBw?MnO@O!Z@TalWOX@OXZAYZ[@O[^AY^p@Oqr@OrsAYsw@OwxAYx!]@O!]!^Az!^!aAY!a#S@O#S#TAY#T;'S@O;'S;=`Bq<%lO@O!RA]UOpAYq!]AY!]!^Ao!^;'SAY;'S;=`At<%lOAY!RAtOc!R!RAwP;=`<%lAY!ZBRYlWc!ROX+PZ[+P^p+Pqr+Psw+Px!^+P!a#S+P#T;'S+P;'S;=`+t<%lO+P!ZBtP;=`<%l@O!_COhiSlWOX@OXZAYZ[@O[^AY^p@OqrBwrsAYswBwwxAYx!PBw!P!Q@O!Q!]Bw!]!^Dj!^!aAY!a#SBw#S#TE{#T#sBw#s$f@O$f;'SBw;'S;=`HS<%l?AhBw?Ah?BY@O?BY?MnBw?MnO@O!_DsbiSlWc!ROX+PZ[+P^p+Pqr/^sw/^x!P/^!P!Q+P!Q!^/^!a#S/^#S#T0m#T#s/^#s$f+P$f;'S/^;'S;=`1e<%l?Ah/^?Ah?BY+P?BY?Mn/^?MnO+P!VFQbiSOpAYqrE{rsAYswE{wxAYx!PE{!P!QAY!Q!]E{!]!^GY!^!aAY!a#sE{#s$fAY$f;'SE{;'S;=`G|<%l?AhE{?Ah?BYAY?BY?MnE{?MnOAY!VGaXiSc!Rqr0msw0mx!P0m!Q!^0m!a#s0m$f;'S0m;'S;=`1_<%l?Ah0m?BY?Mn0m!VHPP;=`<%lE{!_HVP;=`<%lBw!ZHcW!cxaP!b`Or(trs'ksv(tw!^(t!^!_)e!_;'S(t;'S;=`*P<%lO(t!aIYliSaPlW!b`!dpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx}-_}!OKQ!O!P-_!P!Q$q!Q!^-_!^!_*V!_!a&X!a#S-_#S#T1k#T#s-_#s$f$q$f;'S-_;'S;=`3X<%l?Ah-_?Ah?BY$q?BY?Mn-_?MnO$q!aK_kiSaPlW!b`!dpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx!P-_!P!Q$q!Q!^-_!^!_*V!_!`&X!`!aMS!a#S-_#S#T1k#T#s-_#s$f$q$f;'S-_;'S;=`3X<%l?Ah-_?Ah?BY$q?BY?Mn-_?MnO$q!TM_XaP!b`!dp!fQOr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&X!aNZ!ZiSgQaPlW!b`!dpOX$qXZ&XZ[$q[^&X^p$qpq&Xqr-_rs&}sv-_vw/^wx(tx}-_}!OMz!O!PMz!P!Q$q!Q![Mz![!]Mz!]!^-_!^!_*V!_!a&X!a!c-_!c!}Mz!}#R-_#R#SMz#S#T1k#T#oMz#o#s-_#s$f$q$f$}-_$}%OMz%O%W-_%W%oMz%o%p-_%p&aMz&a&b-_&b1pMz1p4UMz4U4dMz4d4e-_4e$ISMz$IS$I`-_$I`$IbMz$Ib$Je-_$Je$JgMz$Jg$Kh-_$Kh%#tMz%#t&/x-_&/x&EtMz&Et&FV-_&FV;'SMz;'S;:j!#|;:j;=`3X<%l?&r-_?&r?AhMz?Ah?BY$q?BY?MnMz?MnO$q!a!$PP;=`<%lMz!R!$ZY!b`!dpOq*Vqr!$yrs(Vsv*Vwx)ex!a*V!a!b!4t!b;'S*V;'S;=`*s<%lO*V!R!%Q]!b`!dpOr*Vrs(Vsv*Vwx)ex}*V}!O!%y!O!f*V!f!g!']!g#W*V#W#X!0`#X;'S*V;'S;=`*s<%lO*V!R!&QX!b`!dpOr*Vrs(Vsv*Vwx)ex}*V}!O!&m!O;'S*V;'S;=`*s<%lO*V!R!&vV!b`!dp!ePOr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!R!'dX!b`!dpOr*Vrs(Vsv*Vwx)ex!q*V!q!r!(P!r;'S*V;'S;=`*s<%lO*V!R!(WX!b`!dpOr*Vrs(Vsv*Vwx)ex!e*V!e!f!(s!f;'S*V;'S;=`*s<%lO*V!R!(zX!b`!dpOr*Vrs(Vsv*Vwx)ex!v*V!v!w!)g!w;'S*V;'S;=`*s<%lO*V!R!)nX!b`!dpOr*Vrs(Vsv*Vwx)ex!{*V!{!|!*Z!|;'S*V;'S;=`*s<%lO*V!R!*bX!b`!dpOr*Vrs(Vsv*Vwx)ex!r*V!r!s!*}!s;'S*V;'S;=`*s<%lO*V!R!+UX!b`!dpOr*Vrs(Vsv*Vwx)ex!g*V!g!h!+q!h;'S*V;'S;=`*s<%lO*V!R!+xY!b`!dpOr!+qrs!,hsv!+qvw!-Swx!.[x!`!+q!`!a!/j!a;'S!+q;'S;=`!0Y<%lO!+qq!,mV!dpOv!,hvx!-Sx!`!,h!`!a!-q!a;'S!,h;'S;=`!.U<%lO!,hP!-VTO!`!-S!`!a!-f!a;'S!-S;'S;=`!-k<%lO!-SP!-kO|PP!-nP;=`<%l!-Sq!-xS!dp|POv(Vx;'S(V;'S;=`(h<%lO(Vq!.XP;=`<%l!,ha!.aX!b`Or!.[rs!-Ssv!.[vw!-Sw!`!.[!`!a!.|!a;'S!.[;'S;=`!/d<%lO!.[a!/TT!b`|POr)esv)ew;'S)e;'S;=`)y<%lO)ea!/gP;=`<%l!.[!R!/sV!b`!dp|POr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!R!0]P;=`<%l!+q!R!0gX!b`!dpOr*Vrs(Vsv*Vwx)ex#c*V#c#d!1S#d;'S*V;'S;=`*s<%lO*V!R!1ZX!b`!dpOr*Vrs(Vsv*Vwx)ex#V*V#V#W!1v#W;'S*V;'S;=`*s<%lO*V!R!1}X!b`!dpOr*Vrs(Vsv*Vwx)ex#h*V#h#i!2j#i;'S*V;'S;=`*s<%lO*V!R!2qX!b`!dpOr*Vrs(Vsv*Vwx)ex#m*V#m#n!3^#n;'S*V;'S;=`*s<%lO*V!R!3eX!b`!dpOr*Vrs(Vsv*Vwx)ex#d*V#d#e!4Q#e;'S*V;'S;=`*s<%lO*V!R!4XX!b`!dpOr*Vrs(Vsv*Vwx)ex#X*V#X#Y!+q#Y;'S*V;'S;=`*s<%lO*V!R!4{Y!b`!dpOr!4trs!5ksv!4tvw!6Vwx!8]x!a!4t!a!b!:]!b;'S!4t;'S;=`!;r<%lO!4tq!5pV!dpOv!5kvx!6Vx!a!5k!a!b!7W!b;'S!5k;'S;=`!8V<%lO!5kP!6YTO!a!6V!a!b!6i!b;'S!6V;'S;=`!7Q<%lO!6VP!6lTO!`!6V!`!a!6{!a;'S!6V;'S;=`!7Q<%lO!6VP!7QOyPP!7TP;=`<%l!6Vq!7]V!dpOv!5kvx!6Vx!`!5k!`!a!7r!a;'S!5k;'S;=`!8V<%lO!5kq!7yS!dpyPOv(Vx;'S(V;'S;=`(h<%lO(Vq!8YP;=`<%l!5ka!8bX!b`Or!8]rs!6Vsv!8]vw!6Vw!a!8]!a!b!8}!b;'S!8];'S;=`!:V<%lO!8]a!9SX!b`Or!8]rs!6Vsv!8]vw!6Vw!`!8]!`!a!9o!a;'S!8];'S;=`!:V<%lO!8]a!9vT!b`yPOr)esv)ew;'S)e;'S;=`)y<%lO)ea!:YP;=`<%l!8]!R!:dY!b`!dpOr!4trs!5ksv!4tvw!6Vwx!8]x!`!4t!`!a!;S!a;'S!4t;'S;=`!;r<%lO!4t!R!;]V!b`!dpyPOr*Vrs(Vsv*Vwx)ex;'S*V;'S;=`*s<%lO*V!R!;uP;=`<%l!4t!V!<TXjSaP!b`!dpOr&Xrs&}sv&Xwx(tx!^&X!^!_*V!_;'S&X;'S;=`*y<%lO&X",
  tokenizers: [scriptTokens, styleTokens, textareaTokens, endTag, tagStart, commentContent, 0, 1, 2, 3, 4, 5],
  topRules: {"Document":[0,16]},
  dialects: {noMatch: 0, selfClosing: 515},
  tokenPrec: 517
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
      return {parser: tag.parser, bracketed: true}
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
            if (to > from) return {parser: attr.parser, overlay: [{from, to}], bracketed: true}
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
    let { state, pos } = context, tree = ext_CodeMirror_lib.syntaxTree(state).resolveInner(pos, -1), around = tree.resolve(pos);
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
const htmlPlain = /*@__PURE__*/ext_CodeMirror_lib.LRLanguage.define({
    name: "html",
    parser: /*@__PURE__*/parser$1.configure({
        props: [
            /*@__PURE__*/ext_CodeMirror_lib.indentNodeProp.add({
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
            /*@__PURE__*/ext_CodeMirror_lib.foldNodeProp.add({
                Element(node) {
                    let first = node.firstChild, last = node.lastChild;
                    if (!first || first.name != "OpenTag")
                        return null;
                    return { from: first.to, to: last.name == "CloseTag" ? last.from : node.to };
                }
            }),
            /*@__PURE__*/ext_CodeMirror_lib.bracketMatchingHandle.add({
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
    return new ext_CodeMirror_lib.LanguageSupport(lang, [
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
const autoCloseTags = /*@__PURE__*/ext_CodeMirror_lib.EditorView.inputHandler.of((view, from, to, text, insertTransaction) => {
    if (view.composing || view.state.readOnly || from != to || (text != ">" && text != "/") ||
        !htmlLanguage.isActiveAt(view.state, from, -1))
        return false;
    let base = insertTransaction(), { state } = base;
    let closeTags = state.changeByRange(range => {
        var _a, _b, _c;
        let didType = state.doc.sliceString(range.from - 1, range.to) == text;
        let { head } = range, after = ext_CodeMirror_lib.syntaxTree(state).resolveInner(head, -1), name;
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
                    range: ext_CodeMirror_lib.EditorSelection.cursor(head + insert.length, -1),
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
        /*@__PURE__*/ext_CodeMirror_lib.styleTags({
            Text: ext_CodeMirror_lib.tags.content,
            Is: ext_CodeMirror_lib.tags.definitionOperator,
            AttributeName: ext_CodeMirror_lib.tags.attributeName,
            VueAttributeName: ext_CodeMirror_lib.tags.keyword,
            Identifier: ext_CodeMirror_lib.tags.variableName,
            "AttributeValue ScriptAttributeValue": ext_CodeMirror_lib.tags.attributeValue,
            Entity: ext_CodeMirror_lib.tags.character,
            "{{ }}": ext_CodeMirror_lib.tags.brace,
            "@ :": ext_CodeMirror_lib.tags.punctuation
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
        if (config.base.language.name != "html" || !(config.base.language instanceof ext_CodeMirror_lib.LRLanguage))
            throw new RangeError("The base option must be the result of calling html(...)");
        base = config.base;
    }
    return new ext_CodeMirror_lib.LanguageSupport(base.language == baseHTML.language ? vueLanguage : makeVue(base.language), [
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
