def comments:
    .inner[]
        | .inner[]
        | select(.kind == "ParagraphComment")
        | .inner[]
        | select(.kind=="TextComment")
        | .text
        | gsub("^\\s+"; "")
    ;

select(.kind == "EnumDecl")
    .inner
        | map(comments)
