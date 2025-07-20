# Playground Help

The drawvg playground lets you experiment with the interpreter of the drawvg
filter for FFmpeg. You can run your scripts directly in the browser.

The playground does not send any data to any remote servers. Scripts can be
[stored in the browser](#files), and can be [shared via a URL](#share) that
embeds the (gzipped) code.

The scripts are evaluated by a stripped version of the plugin, compiled into a
[WebAssembly] module. However, most of the functionality from FFmpeg (like
decoders, other filters, etc.) is not available.

[WebAssembly]: https://en.wikipedia.org/wiki/WebAssembly

The interface is composed of 3 panels:

* [Editor](#editor)
* [Player](#player)
* [Monitors](#monitors)

::: {.screenshot}

![Interface](./main.svg)

:::

The panels can be resized by dragging the handlers between them.

## <a name="editor"></a>Editor

The playground provides some basic features to simplify the creation of drawvg
scripts. It is not intended to replicate a full-featured IDE, so the features
are not as complete as they are in other environments.

### Toolbar

::: {.screenshot}

![Interface](./edit-bar.svg)

:::

The toolbar above the code gives access to many of the features of the
playground:

::: {.icons}

* ![Files](./icon-files.svg) Open the [Files](#files) dialog.
* ![Share](./icon-share.svg) Open the [Share](#share) dialog.
* ![Format](./icon-format.svg) [Reformat](#format) the current code.
* ![Examples](./icon-examples.svg) Open the [examples gallery](#examples).
* ![Shortcuts](./icon-hotkeys.svg) Open the Keyboard Shortcuts dialog.
* ![Help](./icon-help.svg) Open the Help dialog.

:::

The label in the middle only appears when a name is given in the [Files](#files)
dialog, or when an [example](#examples) is loaded.

### Features

#### Changes on Selection

Some actions can be performed on selected text:

| Key                            | Action                                   |
|--------------------------------|------------------------------------------|
| <kbd>Tab</kbd>                 | Indent selected lines.                   |
| <kbd>Shift</kbd><kbd>Tab</kbd> | Dedent selected lines.                   |
| <kbd>(</kbd> or <kbd>)</kbd>   | Add parenthesis around selected text.    |
| <kbd>/</kbd>                   | Toggle comments (`//` at the beginning). |

#### Autocompletion

Commands, colors, and the constant values for `setlinecap` and `setlinejoin`,
can be [autocompleted](https://en.wikipedia.org/wiki/Autocomplete)

For commands, the suggestions also show the expected arguments:

::: {.screenshot}

![Autocomplete commands](./autocomplete-commands.svg)

:::

For colors, it shows a preview next to each name:

::: {.screenshot}

![Autocomplete colors](./autocomplete-colors.svg)

:::

You can press <kbd>Up</kbd> and <kbd>Down</kbd> to select a suggestion from the
list, and then either <kbd>Return</kbd> or <kbd>Tab</kbd> to insert it.


#### <a name="format"></a>Formatting Code

Click on ![Format](./icon-format.svg), or press <kbd>Ctrl</kbd><kbd>I</kbd>, to
[reformat the code](https://en.wikipedia.org/wiki/Code_formatter) in the editor.

The formatter tries to preserve the same structure of the original code (like
commas and new lines).

::: {.example}

In this script, each coordinate for `s` is in its own line, and they are
separated by a comma:

```vgs,ignore
repeat 10 {
s
20 50,
50 0
}
```

The formatter transforms it to:

```vgs,ignore
repeat 10 {
    s
        20 50,
        50 0
}
```

:::

#### Errors

Error messages from the interpreter are written to the [Console](#console).

If the script has a syntax error, the invalid token is highlighted as red, and
the hint from the interpreter is shown in a pop-up next to the invalid token.
Only the first error is shown, since the interpreter stops parsing the script
after it.

### Documentation

When the text cursor is over a command, you can press <kbd>F1</kbd> to open a
new browser tab with its help.

The signature for a command is shown in a pop-up when the mouse cursor is over
the command name, or over one of its arguments.

::: {.example}

For this script:

```vgs,ignore
rect 0 0 w h
fill
```

When the mouse cursor is over `w`, a pop-up shows the signature for `rect`, and
it highlights that `w` is the `width` argument:

![Signature Info](./signature-info.svg)

:::

### Hotkeys

There are some global shortcuts that can be used anywhere:

| Key                                             | Handler | Action                           |
|-------------------------------------------------|---------|----------------------------------|
| <kbd>Ctrl</kbd><kbd>S</kbd>                     | Editor  | Open the [Files](#files) dialog. |
| <kbd>Ctrl</kbd><kbd>H</kbd>                     | Editor  | Open the Help dialog.            |
| <kbd>Ctrl</kbd><kbd>K</kbd>                     | Editor  | Open the Shortcuts dialog.       |
| <kbd>Ctrl</kbd><kbd>I</kbd>                     | Editor  | Reformat Code.                   |
| <kbd>Ctrl</kbd><kbd>E</kbd>                     | Player  | Rewind Animation.                |
| <kbd>Ctrl</kbd><kbd>Comma</kbd>                 | Player  | Previous Frame.                  |
| <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Space</kbd> | Player  | Play Backwards.                  |
| <kbd>Ctrl</kbd><kbd>Space</kbd>                 | Player  | Play Forwards.                   |
| <kbd>Ctrl</kbd><kbd>Period</kbd>                | Player  | Next Frame.                      |


### <a name="files"></a>Saved Files

Click on ![Files](./icon-files.svg), or press <kbd>Ctrl</kbd><kbd>S</kbd>, to
manage scripts stored in the playground.

::: {.screenshot}

![Save Files](./save-files.svg)

:::

Each file has a name associated to it. In the capture above, colors are used as
example names.

When there are no saved files, the dialog asks for a name to the current script.

Click on ![New File](./icon-new-file.svg) to create a new empty file.

Click on ![Export ZIP](./icon-export-zip.svg) to download all saved files as a
[ZIP file][zipfile] if you want to keep a copy in your own devices.

[zipfile]: https://en.wikipedia.org/wiki/ZIP_(file_format)

You can use the keyboard to select a file: <kbd>Up</kbd> and <kbd>Down</kbd>
to change the current selection, and <kbd>Return</kbd> to open it.

The data is stored in the
[`localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
of your browser. If you clear your browser data, or if you are using
private/incognito mode, the files will be lost when the browser is restarted.

### <a name="examples"></a>Examples

Click on ![Examples](./icon-examples.svg) to open a gallery of examples.

To load one of the examples, you can double-click on it, or select it and then
either click on the *Open* button, or press <kbd>Return</kbd>. The example is
then loaded as a new [file](#files).

Some of these examples are more complex than what is expected in the common
usage of drawvg. They are intended to show how to accomplish different drawings.

Examples can be loaded using the keyboard: select with the arrow keys
(<kbd>Up</kbd>, <kbd>Down</kbd>, <kbd>Left</kbd>, <kbd>Right</kbd>), and then
open it with <kbd>Return</kbd>.

### <a name="share"></a>Sharing

Click on ![Share](./icon-share.svg) to generate a URL that contains the source
of the current script. You can send this URL to someone else, or store it as a
bookmark, in order to load the same script.


::: {.screenshot}

![Share](./share.svg)

:::

#### Extracting the Code

The `gzip` parameter of the URL is a [Base64-encoded][base64] string of a
[gzip file][gzip] containing the source code. You can get the source code
from that parameter with a shell script:

[gzip]: https://en.wikipedia.org/wiki/Gzip
[base64]: https://en.wikipedia.org/wiki/Base64

```bash
echo "$URL" \
    | perl -pe 's/.*gzip=//; s/%(..)/chr(hex($1))/ge' \
    | base64 --decode \
    | gzip --decompress --stdout
```

## <a name="player"></a>Player

The output of a drawvg script is a raster image, which is rendered in the panel
next to the editor. The browser must support the [Web Workers][webworkers] and
[WebGL][webgl] APIs.

[webworkers]: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
[webgl]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API

### Actions

::: {.screenshot}

![Interface](./play-bar.svg)

:::

The toolbar above the player gives access to these actions:

::: {.icons}

* ![Rewind](./icon-rewind.svg) [Rewind the animation to the first frame](#player-rewind).
* ![Step Backwards](./icon-step-backwards.svg) [Go back to previous frame](#player-step).
* ![Play Backwards](./icon-play-backwards.svg) [Start animation backwards](#player-backwards).
* ![Panel Forwards](./icon-play-forwards.svg) [Start animation](#player-forwards).
* ![Start Forwards](./icon-step-forwards.svg) [Go to next frame](#player-step).
* ![Export Image](./icon-export-image.svg) Save the current frame as an image.
* ![Export Video](./icon-export-video.svg) [Export the animation into a video](#export-video).

:::

The toolbar also includes an element to [control the size](#player-size), and
another element to change the [animation speed](#player-speed).

### Animations

By default, the player displays a still image, but it can also animate the
script, either forwards or backwards. The animation is rendered by evaluating the
script with different values for the <code>n</code> (frame number) and
<code>t</code> (timestamp) variables in each frame.

The playback can be managed by the following actions:

::: {.definitions}

* <a name="player-forwards"></a>**Start the animation.**

    Click on ![Play](./icon-play-forwards.svg) or press
    <kbd>Ctrl</kbd><kbd>Space</kbd>.

    If there is an animation running, this action will pause it instead.

    Clicking on the canvas can also play or pause the animation. This is the
    same behaviour of most video players in a Web browser.

* <a name="player-backwards"></a>**Start a backwards animation.**

    Click on ![Play Backwards](./icon-play-backwards.svg) or press
    <kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Space</kbd>.

    To animate backwards, the values for the <code>n</code> and <code>t</code>
    variables are decremented in each frame.

* <a name="player-step"></a>**Step one frame.**

    Click on ![Step Forwards](./icon-step-forwards.svg) or press
    <kbd>Ctrl</kbd><kbd>Period</kbd> to go to the next frame.

    Click on ![Step Backwards](./icon-step-backwards.svg) or press
    <kbd>Ctrl</kbd><kbd>Comma</kbd> to go back to the previous frame.

    If there is an animation running, this action will pause it before jumping
    to the next/previous frame.

* <a name="player-rewind"></a>**Rewind the animation**

    Click on ![Rewind](./icon-rewind.svg), or press <kbd>Ctrl</kbd><kbd>E</kbd>.

    This action resets the <code>n</code> and <code>t</code> variables to `0`.

:::

#### <a name="player-speed"></a>Animation Speed

The element in the middle of the toolbar allows you to speed up or slow down the
animation. The initial value is `1x`, which means the animation is running at
normal speed.

When speed is `1x`, the variable <code>n</code> always takes integer values
(`0`, `1`, `2`, ...). But when it is different from `1x`, the values are
interpolated. For example, is speed is `0.5x`, <code>n</code> will be `0`,
`0.5`, `1`, `1.5`, etc. This behaviour is not present when drawvg is running
within FFmpeg.

### <a name="player-size"></a>Size

The canvas is the surface where the output of the drawvg script is shown. Its
size can be controlled with the following options:

::: {.definitions}

* **Fit to Panel Size**

    The canvas size is the size of the panel.

    When the panel is resized, the canvas is also resized, and the script is
    reevaluated with the new values for the <code>w</code> and <code>h</code>
    variables.

    This is the default option.

* **Keep the Current Size**

    Fix the canvas to its current size. If the panel is resized, the canvas will
    keep its size.

    If the panel is larger than the canvas after resizing the panel, the canvas
    will be centered.

    If the panel is smaller than the canvas, scrollbars will be added to be able
    to see the parts of the outside the viewport.

* **Use a Fixed Size**, like `200x200`, `640x480`, or `1024x768`.

    Similar to the previous option, but instead of using the current size, it
    uses a predefined size.

    This list is just for convenience, to have easy access for a few known
    values.

:::

The size is displayed on the left of the toolbar above the canvas.

### <a name="export-video"></a>Video Export

Click on ![Export Video](./icon-export-video.svg) to animate the current script
and export it into a [WebM file](https://en.wikipedia.org/wiki/WebM).

::: {.screenshot}

![Export Video](./export-video.svg)

:::

There are a few parameters to configure the render, but in most cases you may
only need the first two parameters (the duration and the frame size).

Depending on the platform and the parameters, this process may need a lot of
resources. If you want to export a large video, it is recommended to do a small
test in your device before the full export.

The browser must support the [WebCodecs API][webcodecs]. Specifically, the
[`VideoEncoder`][VideoEncoder] interface.

[webcodecs]: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
[VideoEncoder]: https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder

## <a name="monitors"></a>Monitors

Below the player there is a panel with two tabs: [Console](#console) and
[Render Time](#rendertime).

They contain information about the execution of the drawvg script.

### <a name="console"></a>Console

This panel displays the messages written by the drawvg interpreter running in a
[WebAssembly] module.

In messages from drawvg scripts (either the `print` command, or the
<code>print</code> function), the values for the <code>n</code> and
<code>t</code> variables are included on the right side.

If the same message is printed multiple times, the console displays a single
message, prefixed with the number of times it was repeated. This is the same
behaviour of [`console.log`][consolelog] in many Web browsers.

[consolelog]: https://developer.mozilla.org/en-US/docs/Web/API/console/log_static

The console keeps a limited number of messages. This limit can be adjusted in
the menu above the console. You can also click on ![Trash](./icon-trash.svg) to
remove all messages.

During the execution of the script, messages are kept in an internal buffer in
the [WebAssembly] module, and they are pulled periodically. If the script prints
too many messages (for example, in a `repeat` loop) and the buffer is full, the
console displays a warning to indicate how many events were lost.

When the script is modified, the messages that are already in the console are
greyed out, and the new ones are displayed using the normal color. This makes
easier to identify the messages from the latest version of the script.

### <a name="rendertime"></a>Render Time

The Render Time tab displays metrics about the duration, in milliseconds, to
render each frame.

The measurement only considers the time to execute the script. It does not
include the time to display the image in the canvas (via [WebGL][webgl]).

::: {.screenshot}

![Render Time](./rendertime.svg)

:::

Each row shows the data collected from a range of samples, in three parts:

::: {.definitions}

* **Sample Index**

    The first column is the lowest index of the range.

    For example, in the capture above, the second row includes samples from the
    index `44` to `86`.

    New samples are added to the bottom, so the data in the row with the index
    `0` is the oldest one.

    When the number of samples reaches the limit (`600` in the capture), the
    oldest samples are removed, and the indices in the column are rotated (i.e.
    the data in the row of index `44` will be in the index `0` after rotation).

* **Statistics**

    The next 3 columns are statistics from the samples in that range: minimum,
    average, and maximum.

* **Heat Map**

    The right side of the panel is a [heat map] to aggregate the duration to
    render each frame.

    The labels in the header are the duration values.

    Each column represents a duration range.

    When the mouse is over a cell, it displays the number of samples in that
    cell, and the header is updated to show the exact duration range for that
    column.

    Colors are from yellow to red. A color close to red indicates a greater
    number of samples in that duration range.

:::

[heat map]: https://en.wikipedia.org/wiki/Heat_map

The number of rows is adjusted to fit in the height of the panel. A taller panel
will have more rows, and each row will contain less samples.

The tab keeps a limited number of samples. This limit can be adjusted in the
menu above the heat map. You can also click on ![Trash](./icon-trash.svg) to
remove all samples.


The duration is measured with
[`performance.now`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now).
Some browsers may [reduce its precision][reduced_precision], depending on the
privacy configuration, so these measurements must be taken as an approximation.

[reduced_precision]: https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/High_precision_timing#reduced_precision
