"use strict";var e=require("ext.CodeMirror.v6"),i=require("ext.CodeMirror.v6.mode.mediawiki");require("ext.CodeMirror.v6.lib");var r=new e(document.getElementById("wpTextbox1")),o=new URLSearchParams(window.location.search);r.initialize([r.defaultExtensions,i({bidiIsolation:o.get("cm6bidi")})]);