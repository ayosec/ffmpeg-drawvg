# Language Reference

This document is a draft to describe the language used by the drawvg filter. If
the filter is accepted in FFmpeg, please refer to the official documentation in
<https://ffmpeg.org/documentation.html>.

## Syntax

### Structure

* Words (like bash)

### Instructions

* Fixed list of names.
* Number of arguments.
* Some can repeat.

### Comments

### Arguments

* Number literals.
* Variable names.
* FFmpeg Expressions.
* Colors.
* Constants (setlinejoin, ...)

## Usage

### Paths

* Path fill, stroke, clip
* Line width, join, cap, dashes

### Colors

* Colors
* Gradients

### Transformation Matrix

* scale, rotate, translate

### State

* save/restore

### Variables

### Frame Metadata

### `if` and `repeat` Blocks

### Procedures

### Debugging with `print`

## Instructions

### `arc`

    arc (cx cy radius angle1 angle2)

### `arcn`

    arcn (cx cy radius angle1 angle2)

### `break`

    break

### `circle`

    circle (cx cy radius)

### `clip`

    clip

### `eoclip`

    eoclip

### `Z`, `z`, `closepath`

    Z, z, closepath

### `colorstop`

    colorstop (offset color)

### `colorstoprgba`

    colorstoprgba (offset r g b a)

### `C`, `curveto`

    C, curveto (x1 y1 x2 y2 x y)

### `c`, `rcurveto`

    c, rcurveto (dx1 dy1 dx2 dy2 dx dy)

### `ellipse`

    ellipse (cx cy rx ry)

### `fill`

    fill

### `eofill`

    eofill

### `getmetadata`

    getmetadata varname key

### `H`

    H (x)

### `h`

    h (dx)

### `if`

    if (condition) { subprogram }

### `lineargrad`

    lineargrad (x0 y0 x1 y1)

### `L`, `lineto`

    L, lineto (x y)

### `l`, `rlineto`

    l, rlineto (dx dy)

### `M`, `moveto`

    M, moveto (x y)

### `m`, `rmoveto`

    m, rmoveto (dx dy)

### `newpath`

    newpath

### `print`

    print (expr)

### `proc1`

    proc1 name varname { subprogram }

### `call1`

    call1 name (arg)

### `proc2`

    proc2 name varname1 varname2 { subprogram }

### `call2`

    call2 name (arg1 arg2)

### `proc`

    proc name { subprogram }

### `call`

    call name

### `Q`

    Q (x1 y1 x y)

### `q`

    q (dx1 dy1 dx dy)

### `radialgrad`

    radialgrad (cx0 cy0 radius0 cx1 cy1 radius1)

### `rect`

    rect (x y width height)

### `repeat`

    repeat (count) { subprogram }

### `resetclip`

    resetclip

### `resetdash`

    resetdash

### `restore`

    restore

### `rotate`

    rotate (angle)

### `roundedrect`

    roundedrect (x y width height radius)

### `save`

    save

### `scale`

    scale (s)

### `scalexy`

    scalexy (sx sy)

### `setcolor`

    setcolor (color)

### `setdash`

    setdash (length)

### `setdashoffset`

    setdashoffset (offset)

### `sethsla`

    sethsla (h s l a)

### `setlinecap`

    setlinecap (cap)

### `setlinejoin`

    setlinejoin (join)

### `setlinewidth`

    setlinewidth (width)

### `setrgba`

    setrgba (r g b a)

### `setvar`

    setvar (varname value)

### `stroke`

    stroke

### `pstroke`

    pstroke

### `S`

    S (x2 y2 x y)

### `s`

    s (dx2 dy2 dx dy)

### `translate`

    translate (tx ty)

### `T`

    T (x y)

### `t`

    t (dx dy)

### `V`

    V (y)

### `v`

    v (dy)

