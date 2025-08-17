import ExampleRender from "./ExampleRender";

interface Props {
    introduction: string;
    langRefURL: string;
    playgroundURL: string;
}

type CommandTag = (props: { name: string }) => React.ReactNode;

export default function Content ({ introduction, langRefURL, playgroundURL }: Props) {
    const C: CommandTag = ({ name }) => (
        <a className="vgs-command" href={ `${langRefURL}#cmd_${name}` }>
            { name }
        </a>
    );

    return makeText(introduction, langRefURL, playgroundURL, C);
}

Content.Examples = [
    "Progress Indicator",
    "Using Frame Metadata",
    "CircleCrop Transition",
    "Custom Transitions",
    "Reading Colors",
    "Waves Effect",
].map(title => ({
    title,
    link: "example_" + title.toLowerCase().replaceAll(/\W/g, "_"),
}));

const Example = ({ id }: { id: number }) => (
    <h3>
        <a name={ Content.Examples[id].link }></a>
        { Content.Examples[id].title }
    </h3>
);

const makeText = (
    introduction: string,
    langRefURL: string,
    playgroundURL: string,
    C: CommandTag
) => <>
    <h1>drawvg filter for FFmpeg</h1>

    <div dangerouslySetInnerHTML={{ __html: introduction }} />

    <h2>Examples</h2>

    <p>
        This is a short list of examples to showcase how to integrate the
        drawvg filter with other filters in FFmpeg.
    </p>

    <p>
        The <a href={ playgroundURL }>Playground</a> has a gallery with more
        examples, focused on the capabilities of the VGS language.
    </p>

    <Example id={0} />

    <p>
        The variable <code>t</code> can be used to compute one of the
        angles of the <C name="arcn" /> command. Then, we can create an
        animation like this:
    </p>

    <ExampleRender.Video
        sources={ [ "progress.vgs", "progress-plain.bash" ] }
    />

    <p>The script can be rendered directly on top of a video:</p>

    <ExampleRender
        langRefURL={ langRefURL }
        sources={ [ "progress.vgs", "progress.bash" ] }
    />

    <VideoRef1 />

    <Example id={1} />

    <p>
        The <FilterRef name="cropdetect" /> filter calculates the necessary
        cropping parameters to remove black borders around a video. These
        parameters are added to each frame
        as <a href="https://trac.ffmpeg.org/wiki/FilteringGuide#FilterMetadata">metadata</a>.
    </p>

    <p>
        drawvg can access the output of <FilterRef name="cropdetect" /> with
        the <C name="getmetadata" /> command. The following example draws a red
        rectangle to represent the calculated area by <FilterRef name="cropdetect" />.
    </p>

    <ExampleRender
        langRefURL={ langRefURL }
        sources={ [ "cropdetect.vgs", "cropdetect.bash" ] }
    />

    <VideoRef2 />

    <Example id={2} />

    <p>
        This example creates a transition similar to the
        <> <a href="https://trac.ffmpeg.org/wiki/Xfade#:~:text=circlecrop"><code>circlecrop</code> transition</a> </>
        of the <FilterRef name="xfade" /> filter, but the circle can be positioned anywhere, not only
        at the center of the frame.
    </p>

    <ExampleRender
        langRefURL={ langRefURL }
        sources={ [ "circlecrop.vgs", "circlecrop.filter", "circlecrop.bash" ] }
    />

    <VideoRef1 />

    <Example id={3} />

    <p>
        Another way to create custom transitions is to use the <FilterRef name="alphamerge" /> and
        <> </><FilterRef name="overlay" /> filters, with a mask rendered with a drawvg script.
    </p>

    <p>This is the output of the drawvg script:</p>

    <ExampleRender.Video
        sources={ [ "transition.vgs", "transition-plain.bash" ] }
    />

    <p>
        <FilterRef name="alphamerge" /> can set these frames as the alpha
        channel of a video. Then, use <FilterRef name="overlay" /> to put
        the video with the mask on top of another one.
    </p>

    <ExampleRender
        langRefURL={ langRefURL }
        sources={ [ "transition.vgs", "transition.filter", "transition.bash" ] }
    />

    <VideoRef1 />

    <Example id={4} />

    <p>
        The function <code>p(x, y)</code> returns the color of a pixel at the given
        coordinates. It can be used to apply pixelization to a frame, similar to
        the <FilterRef name="pixelize" /> filter.
    </p>

    <p>
        Instead of rectangles, the shape used for pixelization are rhombuses,
        and each one has a thin border to highlight its outline.
    </p>

    <p>
        The output below shows the original frame on the left, and the frame updated
        by the drawvg script on the right:
    </p>

    <ExampleRender
        langRefURL={ langRefURL }
        sources={ [ "pixelate.vgs", "pixelate.filter", "pixelate.bash" ] }
    />

    <VideoRef1 />

    <Example id={5} />

    <p>
        drawvg can be combined with the <FilterRef name="displace" /> filter to
        create a wave effect:
    </p>

    <ExampleRender.Video
        sources={ [ "waves.vgs", "waves-plain.filter", "waves-plain.bash" ] }
    />

    <p>
        First, a drawvg script renders horizontal rectangles with different shades
        of gray. Then, <FilterRef name="boxblur" /> is used to soften the transition
        between rectangles. This image is used as the <code>xmap</code> input for
        <> </><FilterRef name="displace" />. The output below contains the
        intermediate images.
    </p>

    <ExampleRender
        langRefURL={ langRefURL }
        sources={ [ "waves.vgs", "waves.filter", "waves.bash" ] }
    />

    <VideoRef1 />
</>;


const FilterRef = ({ name }: { name: string }) => (
    <a
        className="ffmpeg-filter-link"
        href={ "https://ffmpeg.org/ffmpeg-filters.html#" + name }
    >{ name }</a>
);

const VideoRef1 = () => (
    <p>
        { "This example uses clips from the " }
        <a href="https://peach.blender.org/download/">Big Buck Bunny movie</a>
        { ", available under " }
        <a href="http://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>
        { " license." }
    </p>
);

const VideoRef2 = () => (
    <p>
        { "This example uses the video " }
        <a href="https://www.pexels.com/video/night-drive-on-highway-with-passing-cars-31940329/">Night Drive on Highway with Passing Cars</a>
        { ", free to use by the " }
        <a href="https://www.pexels.com/license/">pexels license</a>
        { "." }
    </p>
);
