# Language Reference

This document is a draft to describe the language used by the drawvg filter. If
the filter is accepted into FFmpeg, please refer to the official documentation in
<https://ffmpeg.org/documentation.html>.

Internally, the language is known as VGS (*Vector Graphics Script*). In this
document, the term *drawvg* always refers to the programming language used by
the filter.

### Introduction

drawvg (*draw vector graphics*) is a language to draw two-dimensional graphics
on top of video frames. It is not intended to be used as a general-purpose
language. Since its scope is limited, it prioritizes being concise and easy
to use.

For example, using the [Canvas API] we can render a triangle running this code
in a Web browser:

[Canvas API]: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API

```javascript
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

ctx.beginPath();
ctx.moveTo(125, 50);
ctx.lineTo(100, 100);
ctx.lineTo(150, 100);
ctx.closePath();
ctx.stroke();
```

The same triangle can be written with this drawvg script:

```vgs
moveto 125 50
lineto 100 100 150 100
closepath
stroke
```

It can be shortened using the aliases for `moveto`, `lineto`, and `closepath`:

```vgs,ignore
M 125 50
L 100 100 150 100
Z
stroke
```

Both newlines (`U+000A`) and spaces (`U+0020`) can be used interchangeably as
delimiters, so multiple commands can appear on the same line:

```vgs,ignore
M 125 50 L 100 100 150 100 Z
stroke
```

Finally, drawvg can use [!ffmpeg-expr] and frame metadata in command arguments.
In this example, we are using the variables `w` (frame width) and <code>h</code>
(frame height) to create a circle in the middle of the frame.

```vgs
circle (w / 2) (h / 2) (w / 3)
stroke
```

Many commands are a direct equivalent to a function in the [Cairo graphics
library](https://www.cairographics.org/). For such commands, the reference below
provides a link to the related Cairo documentation.

## Syntax

The syntax is heavily inspired by languages like [Magick Vector Graphics][MGV],
or [!svg-path]. Many command names are taken from [PostScript].

[!svg-path]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/path "SVG's `<path>`"
[MGV]: https://imagemagick.org/script/magick-vector-graphics.php
[PostScript]: https://en.wikipedia.org/wiki/PostScript

### Structure

A drawvg script consists of a series of commands to describe 2D graphics.

A command is an identifier (like `setcolor` or `lineto`) followed by its
arguments. Each item in the code (command name, arguments, etc.) is separated
by any of the following characters:

| Name    | C Syntax | Unicode  |
|---------|----------|----------|
| Space   | `' '`    | `U+0020` |
| Comma   | `','`    | `U+002C` |
| Newline | `'\n'`   | `U+000A` |
| Tabs    | `'\t'`   | `U+0009` |
| Return  | `'\r'`   | `U+000D` |

The beginning of the item indicates how it will be interpreted:

| Start                 | Item Type                        |
|-----------------------|----------------------------------|
| `//`                  | Comment                          |
| `0`, …, `9`, `+`, `-` | Number literal                   |
| `(`                   | Expression                       |
| `{`, `}`              | Block delimiters                 |
| Anything else         | Name of a command, a color, etc. |

### Comments

Comments start with two slashes (`//`), and stop at the end of the line (either
a `\n`, or the end of the script).

```vgs,ignore
circle 100 100 50 // this is ignored
fill

// this is also ignored
```

`//` must appear after a space, or at the beginning of the line. If `//` is
preceded by any non-blank character, the parser will consider `//` as part of
the previous item.

For example, in this script:

```vgs,ignore,error[1:14:4]
circle 10 10 50// something
```

The parser throws an error because it tries to parse `50//` as a number literal.


### Commands

The way commands are parsed is inspired by [!svg-path]:

* Every command in the script starts with its name, and it is followed by
  zero or more arguments.
* There are no explicit delimiters between commands or arguments.

    Most programming languages expect characters like parenthesis, commas, or
    semicolons, to separate items. For example:

    ```javascript
    moveto(10, 10); lineto(20, 30);
    ```

    The equivalent in drawvg is:

    ```vgs,ignore
    moveto 10 10 lineto 20 30
    ```

* If the command has no arguments (like `closepath` or `stroke`), the next
  command starts at the next item.

::: {.example}

In the next script there are 4 different commands:

```vgs,ignore
newpath rect 10 20 30 40 setcolor teal fill
```

1. `newpath` requires no arguments.
2. `rect` requires 4 arguments, so it takes the next 4 numbers.
3. `setcolor` requires 1 argument, so it takes the word `teal`.
4. `fill` requires no arguments.

:::

#### Single-Letter Aliases

Most commands in [!svg-path] are also present in drawvg. For some of them, there
is an alias to a longer name:

* `curveto` for `C`.
* `rcurveto` for `c`.
* `lineto` for `L`.
* `rlineto` for `l`.
* `moveto` for `M`.
* `rmoveto` for `m`.
* `closepath` for `Z`, `z`.

Other commands only exist in a single-letter form:

* `H`, `h`
* `Q`, `q`
* `S`, `s`
* `V`, `v`
* `T`, `t`

This makes it possible to use a path in SVG to create the same shape in a drawvg
script.

#### <a name="implicit-commands"></a>Implicit Commands

For many commands, the name can be omitted when it is used multiple times in
successive calls.

In the reference below, these commands has a *Can be Implicit* note in their
signature.

::: {.example}

For example, in this script:

```vgs
M 50 50
l 10 10
l 10 -10
l 10 10
l 10 -10
l 10 10
stroke
```

After the first call to `l` (alias to `rlineto`), the command can be executed
without the name, so it can be written as:

```vgs
M 50 50
l 10 10 10 -10 10 10 10 -10 10 10
stroke
```

:::

To reuse the same command (`l`, in the previous example), the parser checks if
the item after the last argument is a numeric value, like a number literal or a
FFmpeg expression.

::: {.example}

In this example:

```vgs,ignore
l 10 20 30 40 stroke
```

`l` requires 2 arguments, and can be implicit, so the parser performs this
operation:

1. Takes the two next items (`10` and `20`) and emits the first instruction.
2. Checks if the item after `20` is a numeric value. Since it is `30`, it
   takes `30` and `40` and emits the second instruction (`l 30 40`).
3. Checks if the next item after `40` is a numeric value, but it is a command
   (`stroke`), so it stops reusing `l`.


:::

This is another feature taken from [!svg-path]. An important difference with
SVG is that the separator between items is always required. In SVG, it can be
omitted in some cases. For example, the expression `m1-2` is equivalent to
`m 1 -2` in SVG, but a syntax error in drawvg.


### Arguments

Most commands expect numeric arguments, like number literals, variable names, or
expressions.

`setcolor` and `colorstop` expect a color.

`setlinecap` and `setlinejoin` expect a constant value.

#### Number Literals

A number literal is an item in the script that represents a constant value. Any
item that starts with a decimal digit (between `0` and `9`), a `-` or a `+`, is
interpreted as a number literal.

The value is parsed with [`av_strtod`]. It supports the prefix `0x` to write a
value with hexadecimal digits, and [many units][ffmpeg-units] (like `K` or `GiB`).

[`av_strtod`]: https://ffmpeg.org/doxygen/trunk/eval_8c.html#a7d21905c92ee5af0bb529d2daf8cb7c3
[ffmpeg-units]: https://ffmpeg.org/ffmpeg-utils.html#:~:text=The%20evaluator%20also%20recognizes%20the%20International%20System%20unit%20prefixes

In the next example, all literals represent the same value:

```vgs,ignore
10000
1e4
10K
0x2710
```

#### Expressions

[!ffmpeg-expr] can be used as arguments for any command that expects a numeric
argument. The expression must be enclosed in parenthesis.

::: {.example}

The variables `w` and <code>h</code> represent the width and height of the
frame. We can compute the center of the frame by dividing them by `2`:

```vgs,ignore
M (w / 2) (h / 2)
```

They can also contain parenthesis (to group operations, to call functions, etc):

```vgs,ignore
moveto
    ((w + 10) / 2)      // x
    (h / (2 * cos(t)))  // y
```

:::

The variables `n` and <code>t</code> can be used to compute a value that changes
over time.

::: {.example}

To draw a circle oscillating from left to right, we can use an expression
based on `sin(t)` for the `x` coordinate:

```vgs,loop[10]
circle
    (w / 2 + sin(2 * t) * w / 4)  // x
    (h / 2)                       // y
    (w / 5)                       // radius

stroke
```

:::

Expressions can be split in multiple lines, but they can't contain comments
within them.

```vgs,ignore,error[2:10:49]
moveto   // This is a comment.
    (w   // This is part of the expression, not a comment.
     + h)

```

#### Variable Names

When an expression is only a reference to a variable, the parenthesis can be
omitted, and the item is just the variable name.

::: {.example}

The next 3 expressions are equivalent: in all cases, they create a rectangle
covering the whole frame.

```vgs,ignore
rect (0) (0) (w) (h)

rect 0 0 w h

rect (0) 0 (w) h
```

:::

It is possible to create a variable with the same name of a command, and then
use it as an argument. In the previous example, the item <code>h</code> is a
reference to a variable (frame height), but in other contexts it may be a
command (`h`).

For [implicit commands], the parser prioritizes commands over variable names
when it has to determine if the command is reused.

::: {.example}

In this example, the variable <code>c</code> is used as the first argument in
two calls to `l`. However, only the first one is valid, because in the second
call the parser recognizes `c` as a command.

```vgs,ignore,error[2:8:1]
setvar c 5
l c 10 c 15
```

This issue can be fixed by surrounding the start of the second call with
parenthesis:

```vgs,ignore,mark[2:8:3]
setvar c 5
l c 10 (c) 15
```

:::

#### <a name="args-colors"></a>Colors

The color to stroke and to fill paths can be set with `setcolor`. Its argument
has the same syntax for colors in FFmpeg:

* A [predefined color name][ffmpeg-colors].
* In `#RRGGBB` format.
* Optionally, an `@a` suffix can be added to set the alpha value, where `a`
  is a number between `0` and `1`.

[ffmpeg-colors]: https://ffmpeg.org/ffmpeg-utils.html#Color

The color can be a variable name. In that case, its value is interpreted as a
`0xRRGGBBAA` code.

::: {.example}

```vgs
circle 75 100 50
setcolor #FF0000
fill

circle 125 100 50
setvar CustomGreen 0x90EEAAFF
setcolor CustomGreen
fill

circle 175 100 50
setcolor blue@0.5
fill
```

:::

The commands `setrgba` and `sethsla` allow setting colors using expressions.

`defrgba` and `defhsla` compute the color and store it in a variable.

#### Constants

The argument for `setlinecap` and `setlinejoin` is an identifier referring to a
constant value.

```vgs,ignore
setlinecap round
```

## Guide

### Paths

A path is a complex shape, composed by lines and curves, that can be used to
fill a region, to stroke an outline, or to establish a clip region.

In order to draw anything on top of a video frame, first we have to define a
path, and then use `stroke` or `fill`.

The [tutorial on paths in MDN][mdn-paths] is a good introduction to the topic.
It is focused on [!svg-path], but the same concepts can be applied in drawvg.

[mdn-paths]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths

#### <a name="current-point"></a>Current Point

Some commands require a *current point*. Initially, the *current point* is set
to [`NaN`][nan]. It is initialized with `M` or `moveto`. Other commands, like
`lineto` or `curveto`, updates the *current point* to the new end of the shape.

[nan]: https://en.wikipedia.org/wiki/NaN

The *current point* can be cleared with `newpath`. Commands that clear the path,
like `stroke` or `fill`, also clear the *current point*.

::: {.example}

`rlineto` uses coordinates relative to the *current point*.

Given this script:

```vgs
moveto 20 100
rlineto 150 -90
rlineto -50 200
closepath
stroke
```

These are the coordinates of the *current point* after executing each command:

| Command                | Current Point |
|------------------------|---------------|
| `moveto 20 100`        | `20, 100`     |
| `rlineto 150 -90`      | `170, 10`     |
| `rlineto -10 50`       | `140, 210`    |
| <code>closepath</code> | `20, 100`     |

The same script can be written with single-letter aliases:

```vgs,ignore
M 20 100 l 150 -90 -50 200 z stroke
```

:::

#### Defining a Shape

A path is defined by adding lines, curves, or basic shapes.

* Basic shapes
    * `circle`
    * `ellipse`
    * `rect`
    * `roundedrect`
* Lines
    * `M`, `moveto`
    * `m`, `rmoveto`
    * `H`, `h`
    * `V`, `v`
    * `L`, `lineto`
    * `l`, `rlineto`
    * `Z`, `z`, `closepath`
* Curves
    * `arc`, `arcn`
    * `C`, `curveto`,
    * `c`, `rcurveto`
    * `Q`, `q`
    * `S`, `s`
    * `T`, `t`

Single-letter commands are taken from [!svg-path].

#### <a name="fill-rules"></a>Fill

The region within the shape defined by a path can be filled with `fill` or
`eofill`. Each command uses a different [fill rule][fill-rules]:

* `fill` uses the [winding rule][rule-winding], also known as
  [nonzero rule](https://en.wikipedia.org/wiki/Nonzero-rule).
* `eofill` uses the [even–odd rule][rule-even-odd].

[fill-rules]: https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-fill-rule-t
[rule-winding]: https://www.cairographics.org/manual/cairo-cairo-t.html#CAIRO-FILL-RULE-WINDING:CAPS
[rule-even-odd]: https://www.cairographics.org/manual/cairo-cairo-t.html#CAIRO-FILL-RULE-EVEN-ODD:CAPS

::: {.example}

This script shows the difference between the [winding][rule-winding] and
[even–odd][rule-even-odd] rules:

```vgs
rect 50 10 100 60
circle 150 70 40
setcolor seagreen
fill

rect 50 130 100 60
circle 150 190 40
setcolor skyblue
eofill
```

:::

#### Stroke

`stroke` draws a line around the shape defined by the path. The stroke can be
configured with different commands:

* `setdash`
* `setdashoffset`
* `setlinecap`
* `setlinejoin`
* `setlinewidth`
* `resetdash`

::: {.example}

This example use `setdashoffset` to animate the stroke:

```vgs,loop[10]
moveto 0 0
lineto w h

setlinecap round
setdash 50 50
setlinewidth 20
setdashoffset (hypot(w, h) * t / -3)
setcolor seagreen

stroke
```

:::

#### Clip

A [clip region](https://en.wikipedia.org/wiki/Clipping_(computer_graphics)) can
be established with `clip` and `eoclip`.

If there is an active clip region, the new clip region will be the intersection
between the existing one and the path. `resetclip` reset the clip region to the
whole frame.

`eoclip` uses the [even–odd rule][rule-even-odd] to compute the clip region.

::: {.example}

```vgs
rect 50 50 100 200
clip

circle 30 30 150
setcolor seagreen
fill

// Draw outside the clip region.
resetclip
circle 30 30 150
setlinewidth 3
setcolor skyblue
stroke
```

:::

#### Preserving Paths

The path is cleared after any operation on it, like `fill` or `stroke`. To reuse
the same path in multiple operations, `preserve` must be called before them.

::: {.example}

In this example, each path is used twice.

```vgs
circle 120 120 50
setcolor seagreen
preserve stroke
clip

circle 100 100 50
setcolor skyblue
preserve fill
setcolor tomato
stroke
```

:::

### Variables

A drawvg can use some variables, provided by the interpreter, to compute values
in [!ffmpeg-expr]:

| Variable        | Description                                |
|-----------------|--------------------------------------------|
| `cx`            | X coordinate of the [current point].       |
| `cy`            | Y coordinate of the [current point].       |
| `w`             | Width, in pixels, of the frame.            |
| <code>h</code>  | Height, in pixels, of the frame.           |
| `i`             | The loop counter in `repeat` blocks.       |
| `n`             | Frame number.                              |
| <code>t</code>  | Timestamp, in seconds.                     |
| <code>ts</code> | Timestamp, in seconds, of the first frame. |
| `duration`      | Duration, in seconds, of the frame.        |

#### <a name="user-variables"></a>User Variables

New variables can be created with the `setvar` command. It associates a name
with a numeric value.

The name must follow these rules:

* It must start with an ASCII letter.
* It can contain only ASCII letters and digits.
* It must not match the name of a variable provided by the interpreter (like `w` or <code>t</code>).

The same variable can be assigned multiple times.

::: {.example}

In this example, the result of an expression is stored in a variable with the
name `progress`. Then, it is used for the `x` and `width` arguments of `rect`.

```vgs,loop[2]
setvar progress (w * (pow(mod(t / 2 + 0.5, 1), 2.5)))

rect ((w - progress) / 2) 0 progress h

setcolor darkblue
fill
```

:::

Currently, a script can contain only 10 different variable names, but this
limit can be modified in the future.


### <a name="patterns"></a>Patterns

The pattern for fill and stroke operations can be either a solid color, or a
gradient.

* Solid colors.
    * `setcolor`
    * `sethsla`
    * `setrgba`
* Gradients.
    * `lineargrad`
    * `radialgrad`

The pattern is not cleared after being used in a fill or stroke operation, but
it is replaced by any command that sets a new pattern.

#### Gradients

To configure a gradient, first call to `lineargrad` or `radialgrad`, and then
add color stops by calling `colorstop` for each stop.

::: {.example}

In this example, the whole frame is filled with a linear gradient:

```vgs
lineargrad 0 0 w h
colorstop 0 skyblue
colorstop 1 darkblue

rect 0 0 w h
fill
```

In this example, a radial gradient is used to simulate a sphere:

```vgs
radialgrad 90 90 5 120 120 100
colorstop 0.0 #90DDFF
colorstop 0.9 #000030
colorstop 1.0 #000000

rect 0 0 w h
fill
```

:::

#### Variables

`setcolor` and `colorstop` accept a variable name as the argument. When a
variable is used, its value is interpreted as a `0xRRGGBBAA` code.

::: {.example}

```vgs
// Use color #1020FF, alpha = 50%
setvar someblue 0x1020FF7F

setcolor someblue

rect 30 30 120 120
fill

rect 90 90 120 120
fill
```

:::

If a variable has the same name of a [FFmpeg color][ffmpeg-colors], the variable
has preference, and will be used instead of the predefined color.

::: {.example}

```vgs,nocolorwords
setcolor teal
rect 30 30 120 120
fill

setvar teal 0x70AAAAFF  // Now, `teal` is #70AAAA
setcolor teal
rect 90 90 120 120
fill
```

:::

`defrgba` and `defhsla` compute the `0xRRGGBBAA` value for a color given its
color components:

* For `defrgba`: *red*, *green*, *blue*, and *alpha*.
* For `defhsla`: *hue*, *saturation*, *lightness*, and *alpha*.

Each color component must be in range `0` to `1`, except *hue*, which is `0` to
`360`.

::: {.example}

```vgs
defrgba colorA 1 0.5 0.25 1     // colorA = RGB(255, 127, 63)
defhsla colorB 200 0.75 0.25 1  // colorB = HSL(200, 75%, 25%)

rect 0 0 (w / 2) h
setcolor colorA
fill

rect (w / 2) 0 (w / 2) h
setcolor colorB
fill
```

:::

### <a name="transformations"></a>Transformations

The coordinates for each command can be scaled, rotated, and translated, by
using the following commands:

* `rotate`
* `scale`
* `scalexy`
* `translate`

The transformations are applied when the command is executed. They have no
effect on the existing path, only on the new segments added to it.

They are done by updating the
[current transformation matrix](https://www.cairographics.org/manual/cairo-Transformations.html)
in the Cairo context. To reset the matrix to its original state, before any
transformation, use `resetmatrix`.

The transform origin for scale and rotation is initially at `0, 0`, but it can
be adjusted with `translate`.


::: {.example}

```vgs
// Map (0, 0) as the center of the frame.
translate (w / 2) (h / 2)

// Scale the space as if the frame is 1x1 pixel.
scalexy w h

// Draw multiple lines with the same arguments,
// but each one on a different rotation.
repeat 10 {
    rotate (PI / 10)
    M -0.25 0
    H 0.25
}

// Reset transformations, so the scale does not
// affect stroke.
resetmatrix

stroke
```

:::

### <a name="state-stack"></a>State Stack

The state of a drawvg script contains all parameters used for drawing
operations, like the current color, the transformation matrix, the stroke
configuration, etc.

The `save` command pushes a snapshot of the state to an internal stack. Later,
`restore` pops the latest snapshot from the stack, and uses it as the new state.

The parameters that can be saved and restored are:

* Pattern for stroke and fill operations.
    * `lineargrad`
    * `radialgrad`
    * `setrgba`
    * `setcolor`
    * `sethsla`
* Transformation matrix.
    * `resetmatrix`
    * `rotate`
    * `scale`
    * `scalexy`
    * `translate`
* Stroke configuration.
    * `setdash`
    * `setdashoffset`
    * `setlinecap`
    * `setlinejoin`
    * `setlinewidth`
* Clip region
    * `clip`
    * `resetclip`

### <a name="frame-metadata"></a>Frame Metadata

Some FFmpeg filters add metadata to frames. The command `getmetadata` can read
metadata items containing a numeric value, and store it in a variable that can
be used for command arguments.

::: {.example}

The `cropdetect` filter computes the parameters to remove empty regions around
the video. These parameters are accessible in the `lavfi.cropdetect` keys of the
frame metadata.

```vgs,ignore
// Get metadata from cropdetect filter and store it
// in `cd*` variables.
getmetadata cdx lavfi.cropdetect.x
getmetadata cdy lavfi.cropdetect.y
getmetadata cdw lavfi.cropdetect.w
getmetadata cdh lavfi.cropdetect.h

rect cdx cdy cdw cdh
setcolor yellow@0.5
setlinewidth 10
stroke
```

To test the script, copy it to a `drawcropdetect.vgs` file, and then execute a
command like this:

```bash
ffplay -i example-video.webm -vf 'cropdetect, drawvg=file=drawcropdetect.vgs'
```

:::

### `if` / `repeat` Statements

There is limited support for control flow statements: only `if` and `repeat`.

Both commands receive two arguments: an expression and a block.

```vgs,ignore
if (condition) {
    // commands
}

repeat (count) {
    // commands
}
```

`if` executes its block if the result of `(condition)` is not zero.

`repeat` executes its block the number of times specified by `(count)`. In each
iteration, the variable `i` is used as a [loop counter].

If the result of the expression is not a finite number (like [`NaN`][nan]) the
block is not executed.

[loop counter]: https://en.wikipedia.org/wiki/For_loop#Loop_counters

#### <a name="comp-operators"></a>Comparison and Logical Operators

[!ffmpeg-expr] only supports arithmetic operators (like `+` for addition).
Comparison operators (like `!=`) are supported via functions, while logical
operators (like `&&` for `AND`) can be emulated with arithmetic operations.

| Expression  | FFmpeg Equivalent  |
|-------------|--------------------|
| `x = y`     | `eq(x, y)`         |
| `x < y`     | `lt(x, y)`         |
| `x > y`     | `gt(x, y)`         |
| `x ≤ y`     | `lte(x, y)`        |
| `x ≥ y`     | `gte(x, y)`        |
| `a ≤ x ≤ b` | `between(x, a, b)` |

Logical operators can be emulated with multiplication (for `AND`), or addition
(for `OR`):

| Expression | FFmpeg Equivalent |
|------------|-------------------|
| `x OR y`   | `x + y`           |
| `x AND y`  | `x * y`           |

::: {.example}

In other programming languages, a code like this:

```javascript
if (x > y && z != 1) {
    // …
}
```

Can be written for drawvg like this:

```vgs,ignore
if (gt(x, y) * not(eq(z, 1))) {
    // …
}
```
:::

#### Early Exit

`break` causes a `repeat` loop to be terminated immediately.

If it is executed outside a `repeat` block, it terminates the whole script, or
the current procedure.

::: {.example}

In this example, we are using the [`randomg`](#randomg) function to draw a line
with random segments.

The loop can be executed `500` times, but it is interrupted if the X coordinate
of the [current point] (`cx`) exceeds the frame width (`w`). The [current point]
is updated after each call to `rlineto`.

```vgs
moveto 0 0

repeat 500 {
    rlineto
        (randomg(0) * 15)
        (randomg(0) * 20)

    if (gt(cx, w)) {
        break
    }
}

stroke
```

:::

### <a name="procedures"></a>Procedures

A procedure is a name associated with a block that can be executed multiple
times.

It can have zero, one, or two arguments. It is defined with `proc`, `proc1`, or
`proc2`, depending on how many arguments are required.

```vgs,ignore
proc p0 {
    // …
}

proc1 p1 arg1 {
    // …
}

proc1 p1 arg1 arg2 {
    // …
}
```

Depending on the number of arguments, they are called with `call`, `call1`, or
`call2`.

```vgs,ignore
call p0

call1 p1 (value1)

call2 p2 (value1) (value2)
```

The arguments (like `arg1` or `arg2` in the previous examples) are accessed as
regular variables.

When the procedure returns, the value of the variable for each argument is
restored to the value before calling the procedure. Changes in other variables
(with `setvar`, `getmetadata`, `defhsla`, and `defrgba`) are preserved.

`break` causes the script to leave the current procedure, if called outside a
`repeat` loop, similar to the [`return` statement][return-stm] in other
programming languages.

[return-stm]: https://en.wikipedia.org/wiki/Return_statement

::: {.example}

In this example, the procedure `zigzag` draws multiple lines from the
[current point].

```vgs
setvar len (w / 10)
setlinewidth 5

proc zigzag {
    repeat 10 {
        l len len len (-len)
    }

    stroke
}

setcolor #40C0FF
M 0 60
call zigzag

setcolor #00AABB
M 0 120
call zigzag

setcolor #20F0B7
M 0 180
call zigzag
```

The color and the Y coordinate of the starting point can be sent as procedure
arguments:

```vgs
setvar len (w / 10)
setlinewidth 5

proc2 zigzag color y {
    setcolor color

    M 0 y
    repeat 10 {
        l len len len (-len)
    }

    stroke
}

call2 zigzag 0x40C0FFFF 60
call2 zigzag 0x00AABBFF 120
call2 zigzag 0x20F0B7FF 180
```

:::

The body of the procedure must be defined with `proc` *before* using `call`.

::: {.example}

In this example, when the procedure `notyet` is called, its body has not yet defined,
so the execution fails with the error `Missing body for procedure 'notyet'`.

```vgs,ignore,error[1:6:6]
call notyet

proc notyet {
    // ...
}
```

:::

### Functions in Expressions

There are some functions specific to drawvg available in [!ffmpeg-expr].

#### Function `p`

`p(x, y)` returns the color of the pixel at coordinates `x, y`, as a
`0xRRGGBBAA` value. This value can be assigned to a variable, which can be used
later as the argument for `setcolor`.

If the coordinates are outside the frame, or any of the arguments is not a
finite number (like [`NaN`][nan]), the function returns `NaN`.

The [transformation matrix](#transformations) is applied to the arguments. To
use the original frame coordinates, call `resetmatrix` between `save` and
`restore`:

```vgs,ignore
save
resetmatrix
setvar pixel (p(0, 0))    // top-left pixel of the frame.
restore

setcolor pixel
```

Bitwise operations can be used to extract individual color components:

```vgs,ignore
setvar pixel (p(x, y))

if (not(isnan(pixel))) {
    setvar px_red   (pixel / 0x1000000)
    setvar px_green (bitand(pixel / 0x10000, 0xFF))
    setvar px_blue  (bitand(pixel / 0x100, 0xFF))
    setvar px_alpha (bitand(pixel, 0xFF))
}
```

#### Function `pathlen`

`pathlen(n)` computes the length of the current path, by adding the length of
each line segment returned by [`cairo_copy_path_flat`].

The function expects an argument `n`, as the maximum number of line segments to
add to the length, or `0` to add all segments.

[`cairo_copy_path_flat`]: https://www.cairographics.org/manual/cairo-Paths.html#cairo-copy-path-flat

::: {.example}

In this example, `pathlen` is used to animate the stroke of a spiral, in a 5
seconds loop.

```vgs,loop[10]
M (w / 2) (h / 2)

setvar a -1
repeat 16 {
    rcurveto
        (a * 2 / 3) 0
        (a * 2 / 3) (a)
        0 (a)

    setvar a (-sgn(a) * (abs(a) + 10))
}

setlinewidth 3
setdash
    (pathlen(0) * (1 - mod(t / 5, 1)))
    1e6

setcolor teal
stroke
```

:::

#### <a name="randomg"></a>Function `randomg`

`randomg(idx)` is similar to the `random(idx)` function, available in
[!ffmpeg-expr], but its state is global to the frame, instead of specific to
each expression.

To understand the difference, we need to dive into how `random(idx)` works
inside a drawvg script.

First, each expression in FFmpeg has a set of 10 internal variables, which can
be written with `st(idx, value)`, and can be read with `ld(idx)`. `idx` is a
value between `0` and `9`. These variables are initialized to `0`.

When a drawvg script is parsed, each expression is compiled with
[`av_expr_parse`], from [libavutil](https://ffmpeg.org/libavutil.html), and
these compiled expressions are reused for every frame. The changes in the
internal variables (with `st(idx, value)`) are visible between frames, but they
are not shared between expressions.

[`av_expr_parse`]: https://ffmpeg.org/doxygen/7.0/eval_8h.html#ad3bf8f3330d1fd139de2ca156c313f34

::: {.example}

In this example, the expression for the X coordinate updates its internal
variable `0` in every frame:

```vgs,loop[10@30]
circle
    (st(0, mod(ld(0) + 15, w))) // X
    120                         // Y
    (ld(0) + 20)                // radius

fill
```

`st(idx, value)` returns the updated value, so it can be used as the result of
the expression.

The radius is not affected because its internal variable (from `ld(0)`) is
not updated by the other expression.

Also, note that this example is just to show how internal variables are kept
between frames. A better approach to create this animation is to use the
variables <code>n</code> or <code>t</code>:

```vgs,ignore
circle (mod(n * 15, w)) 120 20
fill
```

:::

The function `random(idx)` returns a [pseudorandom] value between `0` and `1`.
`idx` is the internal variable that is used both as the seed and to keep the
state of the number generator.

[pseudorandom]: https://en.wikipedia.org/wiki/Pseudorandom_number_generator

::: {.example}

The next example uses `random(0)` to generate a random value for the center of a
circle:

```vgs,loop[2@18]
circle
    (random(0) * w)
    (random(0) * h)
    10

fill
```

The circle in every frame is at a different position, but always on the diagonal
line of the frame. This happens because the values for the coordinates X and Y
are identical, since both number generators use the same seed.

To distribute the circles over the whole frame we need different seeds for each
expression. This can be achieved by writing a non-zero value (like `0xF0F0`) to
the internal variable of one of expressions, but only when its value is `0`:

```vgs,loop[2@18]
circle
    (random(0) * w)
    (st(0, if(ld(0), ld(0), 0xF0F0)); random(0) * h)
    10

fill
```

This approach is only useful if we need completely different positions in each
frame. In the next example, random values are used to distribute many circles
over the frame, but the position is fixed. The only change over time is the fill
color:

```vgs,loop[6]
repeat 20 {
    circle
        (st(0, i + 1e5); random(0) * w)
        (st(0, i + 1e10); random(0) * h)
        10
}

sethsla (t * 60) 0.5 0.5 1
preserve fill

setcolor black@0.5
setlinewidth 1
stroke
```

This is achieved by using a precomputed state before calling `random(0)`. The
variable <code>i</code>, updated by `repeat`, is needed to compute different
states in each iteration.

:::

The `randomg(idx)` function, which is specific to drawvg scripts, is similar to
`random(idx)`, but intended to solve the previous problems:

* All frames have the same seed.
* The state is shared between expressions.

The parameter `idx` has two uses:

* The last two bits are the index of an internal state, so it is possible to
  have 4 different number generators.
* The first call to `randomg` with a specific index will use the argument as the
  seed for the number generator in that index.

In a script like this:

```vgs,ignore
M (randomg(0xFF1)) (randomg(0xFF0))
l (randomg(0xAA1)) (randomg(0xFF0))
```

There are 4 calls to `randomg`:

1. The first call, with the argument `0xFF1`, uses the internal state at index
   `1` (because `0xFF1` modulo `4` is `1`).

   Since this is the first use of that index, the number generator is
   initialized with the seed `0xFF1`.

2. The second call has the same behaviour: it initializes the state at index `0`
   with the value `0xFF0`.

3. The third call has the argument `0xAA1`, and it uses index `1`. Since that
   state is already initialized (with the seed `0xFF1`), the value `0xAA1` is
   ignored, and it returns the next number.

::: {.example}

This example renders a simple rain animation, moving lines from top to bottom.

`randomg` is used to distribute the lines over the frame, and to apply different
speeds to each one.

```vgs,loop[10]
rect 0 0 w h
setcolor midnightblue
fill

setcolor white

repeat 50 {
    setvar offset (t * (randomg(0) + 1))

    moveto
        (mod(randomg(0) + offset / 6, 1) * w)
        (mod(randomg(0) + offset, 1) * h)

    rlineto 6 36

    setlinewidth (randomg(1) / 2 + 0.2)
    stroke
}
```

:::

### Tracing with `print`

It is possible to trace the execution of a drawvg script by printing the
value of an expression, either with the `print` command, or with the
<code>print</code> function.

In both cases, the values are written to the FFmpeg log.

Printing expressions may have a noticeable impact on the performance, so it is
preferable to use it only when necessary.

#### Function <code>print</code>

The function `print(t)` writes the value of <code>t</code>, and returns its
argument.

::: {.example}

Given a line line this:

```vgs,ignore
M (sin(2 * PI * t) * w) 0
```

We can see the values of `sin(2 * PI * t)` by surrounding it with a call to
`print()`:

```vgs,ignore,mark[1:4:5]
M (print(sin(2 * PI * t)) * w) 0
```

Executing this script with a 1 second / 8 FPS video shows the expected values for the
sine function.

```console
$ ffmpeg \
    -f lavfi \
    -i 'color=r=8:d=1, drawvg=M (print(sin(2 * PI * t)) * w) 0' \
    -f null /dev/null \
  |& grep 'Eval @'

[Eval @ 0x7f500f502d20] 0.000000
[Eval @ 0x7f4ff784b420] 0.707107
[Eval @ 0x7f4ff784ba20] 1.000000
[Eval @ 0x7f4ff784c020] 0.707107
[Eval @ 0x7f4ff784c620] 0.000000
[Eval @ 0x7f4ff784cc20] -0.707107
[Eval @ 0x7f4ff784d220] -1.000000
[Eval @ 0x7f4ff784d820] -0.707107
```

:::

#### <a name="command-print"></a>Command `print`

The command `print` accepts an arbitrary number of arguments, and for each one
it writes:

* The source location (line and column).
* The source code of the expression.
* The result of evaluating the expression.

When there are multiple expressions, they are separated by the `|` character.

::: {.example}

The next script prints the position of the [current point] after the `l`
command:

```vgs,ignore
M 10 20
l 100 100
print cx cy
stroke
```

For each frame, it produces this output:

```console
[3:7] cx = 110.000000 | [3:10] cy = 120.000000
```

The next example prints the values of `random(0)`:


```console
$ ffmpeg \
    -f lavfi \
    -i 'color=r=8:d=1, drawvg=print (random(0))' \
    -f null /dev/null \
  |& grep 'drawvg @'

[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.229731
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.959813
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.071676
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.044600
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.134127
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.320513
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.857675
[drawvg @ 0x50a000000180] [1:7] (random(0)) = 0.562456
```

:::

## Commands

### `arc`

```signature
arc xc yc radius angle1 angle2 **
```

Adds a circular arc of the given `radius` to the current path. The arc is
centered at `xc, yc`, begins at `angle1` and proceeds in the direction of
increasing angles to end at `angle2`.

If there is a [current point], a line is added from it to the beginning of the
arc. If this is not desired, use `newpath` before `arc` to clear the
[current point].

See the documentation of the
[`cairo_arc`](https://www.cairographics.org/manual/cairo-Paths.html#cairo-arc)
function for more details.

::: {.example}

```vgs
arc 120 120 60 0 (3 * PI / 2)
stroke
```

:::

### `arcn`

```signature
arcn xc yc radius angle1 angle2 **
```


Similar to `arc`, but it differs in the direction of the arc between the two
angles.

See the documentation of the
[`cairo_arc_negative`](https://www.cairographics.org/manual/cairo-Paths.html#cairo-arc-negative)
function for more details.

::: {.example}

In this example, both `arc` and `arcn` have the same angles, but they render
different arcs:

```vgs
arc  120  90 60 (PI / 2) 0

newpath
arcn 120 150 60 (PI / 2) 0

stroke
```

`newpath` is needed to prevent a line between the two arcs.

:::

### `break`

```signature
break
```

`break` terminates the execution of the innermost block, either a `repeat` loop
or a procedure.

If it is used outside of a `repeat` / `proc` block, it terminates the script
for the current frame.

### `call`

```signature
call name
```

Invokes a procedure defined by `proc`.

See the [Procedures] section above for more details.

[Procedures]: #procedures

### `call1`

```signature
call1 name arg
```

Invokes a procedure defined by `proc1`, passing `arg` as its argument.

See the [Procedures] section above for more details.

### `call2`

```signature
call2 name arg1 arg2
```

Invokes a procedure defined by `proc2`, passing `arg1` and `arg2` as its
arguments.

See the [Procedures] section above for more details.

### `circle`

```signature
circle xc yc radius **
```

Adds a circle of the given `radius` to the current path. The circle is centered
at `xc, yc`. The [current point] is cleared before and after adding the circle.

This is a convenience wrapper for `arc`. A call to `circle` is equivalent to:

```vgs,ignore
newpath
arc xc yc radius (0) (2 * PI)
newpath
```

### `clip`, `eoclip`

```signature
clip, eoclip
```

Establishes a new clip region by intersecting the current clip region with the
current path as it would be filled by `fill` or `eofill`.

`eoclip` uses the [even–odd rule][rule-even-odd]. See [fill rules] for more
details.

[fill rules]: #fill-rules

The path is cleared after updating the clip region, unless the `preserve`
command is used before `clip` or `eoclip`.

See the documentation of the
[`cairo_clip`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-clip)
function for more details.

### `Z`, `z`, `closepath`

```signature
Z, z, closepath
```

Adds a line segment to the path from the [current point] to the beginning of the
current sub-path, and closes this sub-path. The beginning is set by any of the
*move* commands (`M`, `m`, `moveto`, `rmoveto`).

See the documentation of the
[`cairo_close_path`](https://www.cairographics.org/manual/cairo-Paths.html#cairo-close-path)
function for more details.


### `colorstop`

```signature
colorstop offset color **
```

Adds a color stop to a gradient pattern.

`offset` is a value between `0` and `1`, and it specifies the location along the
gradient's control vector.

This command must be executed after `lineargrad` or `radialgrad`.

Color stops can be added in any number of calls to `colorstop`. In the next
example, the 3 blocks define the same gradient:

```vgs,ignore,nocolorwords
// 1
colorstop 0.0 red
colorstop 0.5 green
colorstop 1.0 blue

// 2
colorstop 0 red 0.5 green
colorstop 1 blue

// 3
colorstop 0 red 0.5 green 1 blue
```

See the documentation of the
[`cairo_pattern_add_color_stop_rgba`](https://www.cairographics.org/manual/cairo-cairo-pattern-t.html#cairo-pattern-add-color-stop-rgba)
function for more details.

::: {.example}

In this example, color stops are added in a `repeat` loop.

```vgs
lineargrad 0 0 w h

repeat 6 {
    defhsla s (i * 60) 0.8 0.5 1
    colorstop (i / 5) s
}

rect 0 0 w h
fill
```

It is possible to avoid transitions between color stops by repeating the same
color in two stops:

```vgs,mark[6:5:9],mark[6:15:13]
lineargrad 0 0 w h

repeat 6 {
    defhsla s (i * 60) 0.8 0.5 1
    colorstop (i / 5) s
    colorstop ((i + 1) / 5) s
}

rect 0 0 w h
fill
```

:::

### `C`, `curveto`

```signature
C, curveto x1 y1 x2 y2 x y **
```

Draw a cubic Bézier curve from the [current point] to the *end point* specified
by `x, y`. The *start control point* is specified by `x1, y1` and the *end
control point* is specified by `x2, y2`.

The behaviour is identical to the <code>C</code> command in [!svg-path]. For
more details, see [!mdncubicbeziercurve], and the [!mdntutorialcurve].

[!mdncubicbeziercurve]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/d#cubic_b%C3%A9zier_curve "Cubic Bézier Curve on MDN"
[!mdntutorialcurve]: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorials/SVG_from_scratch/Paths#curve_commands "Curve Commands section of the Paths tutorial on MDN"

::: {.example}

```vgs
moveto 20 20

curveto
    0 (h / 2)           // start control point
    w (h / 2)           // end control point
    (w - 20) (h - 20)   // end point

stroke
```

:::

### `c`, `rcurveto`

```signature
c, rcurveto dx1 dy1 dx2 dy2 dx dy **
```

Like `curveto`, but the coordinates are relative to the [current point].

### `defhsla`

```signature
defhsla varname h s l a
```

Similar to `sethsla`, but instead of establishing the color for stroke and fill
operations, the computed color is stored as a `0xRRGGBBAA` value in the variable
`varname`.

`varname` can then be used as a color for `setcolor` and `colorstop`.

See `sethsla` for more details on how the color is computed.

### `defrgba`

```signature
defrgba varname r g b a
```

Computes a color from the *red*, *green*, *blue*, and *alpha* components, and
assigns it to the variable `varname` as a `0xRRGGBBAA` value.

All components are values between `0` and `1`. Values outside that range are
clamped to it.

### `ellipse`

```signature
ellipse cx cy rx ry **
```

Adds an ellipse to the current path. Similar to `circle`, but it is possible to
use different radius for both axes.

::: {.example}

```vgs
ellipse 120 120 75 50
stroke
```

:::

### `fill`, `eofill`

```signature
fill, eofill
```

Fill the current path, using the [current pattern](#patterns) (either a solid
color or a gradient).

`eofill` uses the [even–odd rule][rule-even-odd]. See [fill rules] for more
details.

The path is cleared after the operation, unless the `preserve` command is used
before `fill` or `eofill`.

See the documentation of the
[`cairo_fill`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-fill)
function for more details.

### `getmetadata`

```signature
getmetadata varname key
```

Get the value of a metadata entry created by another filter, and assign it to
the variable `varname`.

If there is no metadata entry for `key`, or its value is not a number, `varname`
is set to [`NaN`][nan].

See the [Frame Metadata](#frame-metadata) section above for an example.

### `H`, `h`

```signature
H, h x **
```

Draw a horizontal line from the [current point] to <code>x</code>.

The coordinate for `H` is absolute, and for `h` it is relative to the
[current point].

### `if`

```signature
if condition { block }
```

Executes a block if the value of `condition` is not zero, and a finite
number (unlike [`NaN`][nan]).

See the [Comparison and Logical Operators](#comp-operators) section above for
more details on how to write conditional expressions.

### `lineargrad`

```signature
lineargrad x0 y0 x1 y1
```

Set the [current pattern](#patterns) to a new linear gradient, along the line
from the coordinates `x0, y0` to `x1, y1`.

This gradient can be used for stroke and fill operations.

Use `colorstop` to set the color for each position in the gradient.

### `L`, `lineto`

```signature
L, lineto x y **
```

Draw a line from the [current point] to the coordinates at `x, y`.

See the documentation of the
[`cairo_line_to`](https://www.cairographics.org/manual/cairo-Paths.html#cairo-line-to)
function for more details.

### `l`, `rlineto`

```signature
l, rlineto dx dy **
```

Like `lineto`, but the coordinates are relative to the [current point].

### `M`, `moveto`

```signature
M, moveto x y **
```

Begin a new sub-path, and set the [current point] to `x, y`.

### `m`, `rmoveto`

```signature
m, rmoveto dx dy **
```

Like `moveto`, but the coordinates are relative to the [current point].

### `newpath`

```signature
newpath
```

Begin a new sub-path. Like `moveto`, but there is no [current point] after it.

::: {.example}

In the next example, `newpath` is used in the path on the right to prevent the
line connecting both arcs.

```vgs
setlinewidth 3

setcolor skyblue
arcn 70 90 20 0 (PI)
arc 70 150 20 0 (PI)
stroke

setcolor seagreen
arcn 170 90 20 0 (PI)
newpath
arc 170 150 20 0 (PI)
stroke
```

:::

### `preserve`

```signature
preserve
```

Indicates that the next operation to fill, stroke, or clip, must preserve the
path, so the same path can be used in multiple operations.

It has effect on these commands:

* `clip`
* `eoclip`
* `eofill`
* `fill`
* `stroke`

The script can contain any command between `preserve` and the associated
operation. This allows modifying other properties, like the current color.

::: {.example}

In this example, the same path is used for both `fill` and `stroke`, but with
different colors.

```vgs
circle (w / 2) (h / 2) (w / 3)

setcolor skyblue
preserve fill

setlinewidth 10
setcolor seagreen
stroke
```

:::

`preserve` can be called multiple times, if the same path has to be used in
3 or more operations.

::: {.example}

In this example, the path created by `circle` is used by `fill`, `stroke`, and
`clip`. After `clip`, the path is cleared.

```vgs,ignore
circle 100 100 50

preserve fill
preserve stroke
clip
```

:::


### `print`

```signature
print expr **
````

Print its arguments to the FFmpeg log.

See the [Command <code>print</code>](#command-print) section above for more details.

### `proc`

```signature
proc name { block }
```

Assign a block to the procedure `name`. The procedure can be called multiple
times with the `call` command.

The block for a procedure can be reassigned by other calls to `proc`. In such
case, `call` invokes the last assigned block.

::: {.example}

In this example, the procedure `example` has two different blocks.

```vgs,ignore
proc example {
    // block1
}

call example    // executes block1

proc example {
    // block2
}

call example    // executes block2
```

:::

The execution returns to the caller when the last command of the block is
executed, but it can be interrupted early with `break`.

All changes performed in the procedure (setting variables, modifying colors,
adding segments to the path, etc) are preserved when it terminates.

### `proc1`

```signature
proc1 name varname { block }
```

Like `proc`, but the procedure can receive 1 argument. It must be called with
`call1`.

The argument is stored in the variable `varname`. The variable is updated when
the procedure is called, and its value is restored when the procedure returns.

::: {.example}

In the next example, the variable `A` has the value `0` before calling the
procedure `P`. During the execution of `P`, `A` is `1`, but after it, `A` is `0`
again.

```vgs,ignore
setvar A 0

proc1 P A {
    print A
}

print A
call1 P 1
print A
```

It writes the following messages:

```console
[7:7] A = 0.000000
[4:8] A = 1.000000
[9:7] A = 0.000000
```

:::

### `proc2`

```signature
proc2 name varname1 varname2 { block }
```

Like `proc1`, but the procedure can receive 2 arguments. It must be called with
`call2`.

### `Q`

```signature
Q x1 y1 x y
```

Draw a quadratic Bézier curve from the [current point] to the *end point*
specified by `x, y`. The *control point* is specified by `x1, y1`.

The behaviour is identical to the <code>Q</code> command in [!svg-path]. For
more details, see [!mdnquadbeziercurve], and the [!mdntutorialcurve].

[!mdnquadbeziercurve]: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/d#quadratic_b%C3%A9zier_curve "Quadratic Bézier curve on MDN"

::: {.example}

```vgs
moveto 20 20

Q
    0 h                 // control point
    (w - 20) (h - 20)   // end point

stroke
```

:::

### `q`

```signature
q dx1 dy1 dx dy
```

Like `Q`, but the coordinates are relative to the [current point].

### `radialgrad`

```signature
radialgrad cx0 cy0 radius0 cx1 cy1 radius1
```

Creates a new radial gradient between the two circles defined by
`cx0 cy0 radius0` and `cx1 cy1 radius1`. Each set of arguments is the
coordinates of the center and the radius.

This gradient can be used for stroke and fill operations.

Use `colorstop` to set the color for each position in the gradient.

::: {.example}

The animation in the next example shows how the two circles defined in the
`radialgrad` arguments interact with each other.

The red circle represent the circle for the `cx0 cy0 radius0` arguments, and the
yellow circle is the one for the `cx1 cy1 radius1` arguments.

```vgs,loop[8]
setvar cx0 (mod(t * 30, w))
setvar cy0 120
setvar radius0 20

setvar cx1 120
setvar cy1 120
setvar radius1 70

radialgrad
    cx0 cy0 radius0
    cx1 cy1 radius1

colorstop
    0 lightblue
    1 darkblue

// Fill the frame with the gradient.
rect 0 0 w h
fill

// Draw inner circle.
circle cx0 cy0 radius0
setcolor red
stroke

// Draw outer circle.
circle cx1 cy1 radius1
setcolor yellow
stroke
```

:::

### `rect`

```signature
rect x y width height
```

Adds a rectangle of the given size (`width` × `height`), at position `x, y`, to
the current path. The [current point] is cleared before and after adding the
rectangle.

See the documentation of the
[`cairo_rectangle`](https://www.cairographics.org/manual/cairo-Paths.html#cairo-rectangle)
function for more details.

### `repeat`

```signature
repeat count { block }
```

Executes a block the number of times indicated by `count`.

In each iteration, the variable `i` is used as a [loop counter]. It takes the
values from `0` to `count - 1`. When the loop is terminated, the variable
is restored to the value before starting the loop.

If `count` is less than `1`, or it is not a finite number (like [`NaN`][nan]),
the block is not executed.

### `resetclip`

```signature
resetclip
```

Reset the current clip region to its original state, covering the whole frame.

See the documentation of the
[`cairo_reset_clip`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-reset-clip)
function for more details.

### `resetdash`

```signature
resetdash
```

Disable the dash pattern to be used by `stroke`. This reverts any change made by
`setdash` and `setdashoffset`.

It calls
[`cairo_set_dash`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-dash)
with `num_dashes` set to `0`.

### `resetmatrix`

```signature
resetmatrix
```

Resets the current [transformation matrix](#transformations).

### `restore`

```signature
restore
```

Restores the state saved by a preceding call to `save`.

For more details, see the [!state-stack] section above, and the
[`cairo_restore`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-restore)
function.

[!state-stack]: #state-stack "State Stack"

### `rotate`

```signature
rotate angle
```

Modifies the current [transformation matrix](#transformations) by rotating the
user-space axes by `angle` radians.

See the documentation of the
[`cairo_rotate`](https://www.cairographics.org/manual/cairo-Transformations.html#cairo-rotate)
function for more details.

::: {.example}

In this example:

* `scalexy` maps the coordinates to a 1x1 frame.
* `translate` put `0, 0` at the center of the frame.
* `rotate` rotates 45°.
* `resetmatrix` reverts the transformations before `stroke`, so the line width
  is not affected by the scale.

```vgs
scalexy w h
translate 0.5 0.5
rotate (PI / 4)
rect -0.25 -0.25 0.5 0.5
resetmatrix
stroke
```

:::

### `roundedrect`

```signature
roundedrect x y width height radius **
```

Like `rect`, but a circular arc is used for the corners.

::: {.example}

The next example shows the same rectangle, with different values for the corner
radius.

The radius is computed by multiplying `i` (the [loop counter]) by `4.5`. This
number is chosen to make the last shape a perfect circle.

```vgs
repeat 9 {
    roundedrect
        (mod(i, 3) * 80 + 5)     // x
        (floor(i / 3) * 80 + 5)  // y
        70 70                    // size
        (i * 4.5)                // radius
}

stroke
```

:::

### `save`

```signature
save
```

Saves a copy of the current state on an internal stack. This copy can be
restored later with `restore`.

For more details, see the [!state-stack] section above, and the
[`cairo_save`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-save)
function.

### `scale`

```signature
scale sxy
```

Similar to `scalexy`, but the same value is used for both axes. It is equivalent
to:

```vgs,ignore
scalexy sxy sxy
```

### `scalexy`

```signature
scalexy sx sy
```

Modifies the current [transformation matrix](#transformations) by scaling the X
and Y user-space axes by `sx` and `sy` respectively.

See the documentation of the
[`cairo_scale`](https://www.cairographics.org/manual/cairo-Transformations.html#cairo-scale)
function for more details.

See `rotate` for an example on combining multiple transformations.


### `setcolor`

```signature
setcolor color
```

Set a solid color as the [current pattern](#patterns) for stroke and fill
operations

See the [Colors](#args-colors) section above for more details.

### `setdash`

```signature
setdash length **
```

Sets the dash pattern to be used by `stroke`.

Each call to `setdash` adds a length to the pattern, alternating between *on*
and *off* portions of the stroke.

After a call to `setdash`, `resetdash` is needed either to create a new pattern,
or to discard the current one.

See the documentation of the
[`cairo_set_dash`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-dash)
function for more details.

### `setdashoffset`

```signature
setdashoffset offset
```

Set the offset into the dash pattern at which the stroke should start.

`setdash` must be called *before* `setdashoffset`.

See the documentation of the
[`cairo_set_dash`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-dash)
function for more details.

::: {.example}

The next animation shows the effect of `setdashoffset` when its argument changes
over time.

```vgs,loop[4]
scalexy w h
M 0.5 1
curveto 0 0.5, 1 0.5, 0.5 0
resetmatrix

setdash 20 5 // 20 on, 5 off
setdashoffset (t * 100)

setlinewidth 20
stroke
```

:::

### `sethsla`

```signature
sethsla h s l a
```

Set the [current pattern](#patterns) to a solid color, given the *hue*,
*saturation*, and *lightness*, and *alpha* components.

<code>h</code> is the *hue*, a value between `0` and `359`. Negative values are
clamped to `0`, and values greater than `359` are interpreted as modulo 360.

<code>s</code> (*saturation*), <code>l</code> (*lightness*), and <code>a</code>
(*alpha*), are values between `0` and `1`.

The conversion to RGB is implemented according to the
[formulae from Wikipedia][hsl2rg].

[hsl2rg]: https://en.wikipedia.org/wiki/HSL_and_HSV#HSL_to_RGB

### `setlinecap`

```signature
setlinecap cap
```

Set the current line cap style, which determines the shape used to draw the end
points of lines.

`cap` must be one of the following names:

* `butt`
* `round`
* `square`

It calls to
[`cairo_set_line_cap`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-line-cap)
to set the line cap style.

::: {.example}

This example draws 3 lines with the same length, each one with a different
line cap style:

```vgs
setlinewidth 40

setlinecap butt
setcolor tomato
M 60 40 v 100 stroke

setlinecap round
setcolor seagreen
M 120 40 v 100 stroke

setlinecap square
setcolor skyblue
M 180 40 v 100 stroke

M 20 40 H 220 m 0 100 H 20
setcolor black@0.5
setlinewidth 2
stroke
```

:::

### `setlinejoin`

```signature
setlinejoin join
```

Sets the current line join style, which determines the shape used to join two
line segments.

`join` must be one of the following names:

* `bevel`
* `miter`
* `round`

It calls to
[`cairo_set_line_join`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-line-join)
to set the line join style.

::: {.example}

This example draws 3 lines with the same length, each one with a different
line join style:

```vgs
setlinewidth 30

setlinejoin bevel
setcolor tomato
M 70 20 l 50 50 50 -50 stroke

setlinejoin miter
setcolor seagreen
M 70 90 l 50 50 50 -50 stroke

setlinejoin round
setcolor skyblue
M 70 160 l 50 50 50 -50 stroke
```

:::

### `setlinewidth`

```signature
setlinewidth width
```

Set the line width for `stroke`.

`width` is affected by the [transformation matrix](#transformations).

To specify a width that is not affected by other transformations, `resetmatrix`
can be used between `save` / `restore`:

```vgs,ignore
save

resetmatrix
setlinewidth 1
stroke

// Restore matrix after stroke.
restore
```


See the documentation of the
[`cairo_set_line_width`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-set-line-width)
function for more details.

### `setrgba`

```signature
setrgba r g b a
```

Set the [current pattern](#patterns) to a solid color, given the *red*, *green*,
*blue*, and *alpha* components.

All components are values between `0` and `1`. Values outside that range are
clamped to it.

### `setvar`

```signature
setvar varname value
```

Set the variable `varname` to `value`.

See the [User Variables](#user-variables) section above for more details.

### `stroke`

```signature
stroke
```

Strokes the current path according to the current line width, line join, line
cap, and dash settings.

The path is cleared after the operation, unless the `preserve` command is used
before `stroke`.

See the documentation of the
[`cairo_stroke`](https://www.cairographics.org/manual/cairo-cairo-t.html#cairo-stroke)
function for more details.

### `S`, `s`

```signature
S, s x2 y2 x y **
```

Draw a smooth cubic Bézier curve from the [current point] to the *end point*
specified by `x, y`. The *end control point* is specified by `x2, y2`.

The *start control point* is the reflection of the *end control point* of the
previous curve command about the *current point*.

The behaviour is identical to the <code>S</code> command in [!svg-path]. For
more details, see [!mdncubicbeziercurve], and the [!mdntutorialcurve].

`s` is like `S`, but the coordinates are relative to the [current point].

::: {.example}

```vgs
M 20 120

c 25 -50, 25 50, 50 0

repeat 3 {
    s 20 50, 50 0
}

stroke
```

:::

### `translate`

```signature
translate tx ty
```

Modifies the current [transformation matrix](#transformations) by translating
the user-space origin by `tx, ty`.

See the documentation of the
[`cairo_translate`](https://www.cairographics.org/manual/cairo-Transformations.html#cairo-translate)
function for more details.

### `T`, `t`

```signature
T, t x y **
```

Draw a smooth quadratic Bézier curve from the [current point] to the *end point*
specified by `x, y`.

The *control point* is the reflection of the *control point* of the previous
curve command about the *current point*.

The behaviour is identical to the <code>T</code> command in [!svg-path]. For
more details, see [!mdnquadbeziercurve], and the [!mdntutorialcurve].

`t` is like `T`, but the coordinates are relative to the [current point].

::: {.example}

```vgs
M 20 120

q 10 -20, 20 0

repeat 9 {
    t 20 0
}

stroke
```

:::

### `V`, `v`

```signature
V, v y **
```

Draw a vertical line from the [current point] to <code>y</code>.

The coordinate for `V` is absolute, and for `v` it is relative to the
[current point].


[!ffmpeg-expr]: https://ffmpeg.org/ffmpeg-utils.html#Expression-Evaluation "FFmpeg expressions"
[current point]: #current-point
[implicit commands]: #implicit-commands
