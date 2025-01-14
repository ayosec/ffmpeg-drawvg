def lum_comp:
    if . <= 0.03928 then
        . / 12.92
    else
        pow((. + 0.055) / 1.055; 2.4)
    end
    ;

def luminance:
    # From https://github.com/sharkdp/pastel/blob/v0.10.0/src/lib.rs#L654-L669
    0.2126 * (.[0] / 255 | lum_comp) +
    0.7152 * (.[1] / 255 | lum_comp) +
    0.0722 * (.[2] / 255 | lum_comp)
    ;

def name:
    .inner[0]
    .inner[0]
    .inner[0]
    .value
        | fromjson
        | ascii_downcase
    ;

def comps:
    .inner[1]
    .inner
        | map(
            .inner[]
            .value
            | fromjson
        )
    ;

def hexchar: "0123456789ABCDEF"[. : . + 1];

def hex:
    "#" + (map("\(. / 16 | floor | hexchar)\(. % 16 | hexchar)") | join(""))
    ;

def styles:
    {
        fg: (if luminance > 0.179 then "#000000" else "#FFFFFF" end),
        bg: hex
    }
    ;

select(.kind == "VarDecl")
    .inner[0]
    .inner
        | map({ (name): (comps | styles) })
        | add
