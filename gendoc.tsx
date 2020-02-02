import ReactDOMServer from "react-dom/server"
import { JSONOutput } from "typedoc"
import * as React from "react"
import { ReactNode, ReactElement } from "react"
import * as fs from "fs"
import { tmpNameSync, file } from "tmp"
import { execSync } from "child_process"
// import filesize from "filesize"
import { gzip, gzipSync } from "zlib"
// @ts-ignore
import unescape from "unescape"
import ReactMarkdown from "react-markdown"
// @ts-ignore
import unescape from "unescape"
// import docjson from "./doc.json"

// const tmpName = tmpNameSync({ postfix: ".json" })
const tmpName = "./out/doc.json"
if (!process.argv.includes("--reusejson")) {
    // console.log("Writing typedoc --json to " + tmpName)
    execSync(
        "node node_modules/typedoc/bin/typedoc src/serializr.ts --mode library --json " + tmpName,
        {
            cwd: __dirname,
            stdio: "inherit"
        }
    )
}
const docjson: JSONOutput.Reflection = require(tmpName)

// @ts-ignore
import { gfm } from "turndown-plugin-gfm"
// @ts-ignore
import TurndownService from "turndown"
import { SourceReference } from "typedoc/dist/lib/models/sources/file"
import { TypeAliasDeclaration } from "typescript"

let scaleCounter = 0

const turndownService = new TurndownService({ codeBlockStyle: "fenced" })
turndownService.use(gfm)
turndownService.keep(["sub"])
const sorter = (a: any, b: any) => a.sources[0].line - b.sources[0].line

const gzippedBundleSize = 0
// const gzippedBundleSize = filesize(
//     gzipSync(fs.readFileSync("./dist/index.umd.min.js", "utf8")).byteLength
// )
console.log("gzippedBundleSize:", gzippedBundleSize)

function DocPage({ docJson }: { docJson: typeof docjson }) {
    // docJson.children[0].children.sort(sorter)
    return (
        <>
            <h2>API</h2>
            {docJson.children.map(x => render(x, ""))}
        </>
    )
}
function Typealias({
    of: { type, sources, typeParameter, comment, name, id }
}: {
    of: JSONOutput.TypeParameterReflection
}) {
    return (
        <>
            <h3 id={"typedoc-id-" + id}>
                <em>type</em> <code>{name}</code>
                <TypeParameters of={typeParameter} /> = <Type {...type} /> <Src {...sources[0]} />
            </h3>
            <Comment of={comment} />
        </>
    )
}

function Comment(props: { of: any }) {
    const { shortText, text, tags } = props.of || {}
    return (
        <>
            <ReactMarkdown source={shortText} />
            <ReactMarkdown source={text} />
            {(tags || []).map(({ tag, text }: { tag: string; text: string }, tagIndex) => {
                const out = (text: string, result?: React.ReactNode) => (
                    <React.Fragment key={tagIndex}>
                        <em>example</em>{" "}
                        <code>
                            {text
                                /* remove existing result in comment */
                                .replace(/\/\/\s*=.*?((?=\/\/)|$)/m, "")
                                .trim()}
                        </code>{" "}
                        {result} <br />
                    </React.Fragment>
                )

                if ("example" === tag) {
                    return (
                        <pre>
                            <code className="language-ts">{text.trim().replace(/\\@/g, "@")}</code>
                        </pre>
                    )
                }
                return (
                    <p>
                        @{tag} {text}
                    </p>
                )
            })}
        </>
    )
}
function Class({
    of: { name, kindString, comment, children, signatures, sources, typeParameter, flags, id }
}: {
    of: JSONOutput.DeclarationReflection
}) {
    if (kindString == "Variable" && flags.isConst) {
        kindString = "const"
    }
    return (
        <>
            <h3 id={"typedoc-id-" + id}>
                <em>{kindString.toLowerCase()}</em> <code>{name}</code>
                <TypeParameters of={typeParameter} />
                <Src {...sources[0]} />
            </h3>
            <Comment of={comment} />
            {signatures &&
                signatures.map((sig, i) => (
                    <Signature of={{ ...sig, name: "__call" }} prefix={name} src={sources[i]} />
                ))}
            {children && children.sort(sorter) && children.map(c => render(c, name))}
        </>
    )
}
function Objectliteral({ name, kindString, comment, children, id }: JSONOutput.Reflection) {
    return (
        <>
            <h3 id={"typedoc-id-" + id}>
                <em>{kindString}</em> <code>{name}</code>
            </h3>
            <Comment of={comment} />
        </>
    )
}
function Method({
    of: { signatures, name, kindString, comment, children, sources },
    prefix
}: {
    of: JSONOutput.DeclarationReflection
    prefix: string
}) {
    return (
        <>
            {signatures.map((sig, i) => (
                <Signature
                    key={i}
                    of={sig}
                    prefix={prefix}
                    src={sources[i]}
                    kindString={kindString}
                />
            ))}
            <Comment of={comment} />
            {children && children.sort(sorter) && children.map(c => render(c, name))}
        </>
    )
}
function Parameters({ of }: { of: JSONOutput.ParameterReflection[] }) {
    return of
        ? reactJoin(
              of.map(param => {
                  const defaultMatch =
                      param.comment &&
                      param.comment.text &&
                      param.comment.text.match(/default=(.*)$/m)
                  const defaultValue = param.defaultValue || (defaultMatch && defaultMatch[1])
                  return (
                      <>
                          {param.flags.isRest && "..."}
                          <em>{param.name}</em>
                          {param.flags.isOptional && !defaultMatch && "?"}:{" "}
                          <Type {...param.type} noUndefinedInUnion={defaultValue} />
                          {defaultValue && " = " + defaultValue.trim()}
                      </>
                  )
              })
          )
        : null
}

function TypeParameters({ of: typeParameters }: { of: JSONOutput.TypeParameterReflection[] }) {
    // tslint:disable-next-line:no-null-keyword react requires null return value
    if (!typeParameters) return null
    const uniqueTPs: JSONOutput.TypeParameterReflection[] = []
    for (const tp of typeParameters) {
        if (!uniqueTPs.some(utp => utp.name == tp.name)) {
            uniqueTPs.push(tp)
        }
    }
    return (
        <>
            {"&lt;"}
            {reactJoin(
                uniqueTPs.map(tp => tp.name),
                ", "
            )}
            {"&gt;"}
        </>
    )
}
function Signature({
    of,
    prefix,
    src,
    kindString
}: {
    of: JSONOutput.SignatureReflection
    prefix: string
    src: SourceReference
    kindString?: string
}) {
    return (
        <>
            <h3>
                <em>{(kindString || of.kindString).toLowerCase()}</em> <a id={of.name} />
                <code>
                    {prefix.toLowerCase()}
                    {of.name}
                </code>
                <TypeParameters of={of.typeParameter} />(<Parameters of={of.parameters} />
                ): <Type {...of.type} /> <Src {...src} />
            </h3>
            <Comment of={of.comment} />
        </>
    )
}
function Type(type: any) {
    switch (type.type) {
        case "reference":
            return (
                <>
                    <a href={"typedoc-id-" + type.id}>{type.name}</a>
                    <TypeParameters of={type.typeArguments} />
                </>
            )
        case "intrinsic":
        case "typeParameter":
        case "unknown":
            return type.name
        case "query":
            return (
                <>
                    typeof <Type {...type.queryType} />
                </>
            )
        case "union":
            return reactJoin(
                type.types
                    .filter(
                        t =>
                            !(
                                type.noUndefinedInUnion &&
                                t.type == "intrinsic" &&
                                t.name == "undefined"
                            )
                    )
                    .map(t => (
                        <Type {...t} inUnion={true} noUndefinedInUnion={type.noUndefinedInUnion} />
                    )),
                " | "
            )
        case "tuple":
            return <>[{reactJoin(type.elements.map((type, i) => <Type {...type} />))}]</>
        case "reflection":
            try {
                if (type.declaration.signatures?.length == 1) {
                    const sig = type.declaration.signatures[0]
                    return (
                        <>
                            {type.inUnion && "("}(<Parameters of={sig.parameters} />) =>{" "}
                            <Type {...sig.type} />
                            {type.inUnion && ")"}
                        </>
                    )
                } else if (type.declaration.kindString === "Type literal") {
                    return (
                        <>
                            {"{  "}
                            {type.declaration.children?.map(c => {
                                if ("Variable" === c.kindString) {
                                    return (
                                        <>
                                            {c.name}: <Type {...c.type} />
                                        </>
                                    )
                                }
                            })}
                            {"  }"}
                        </>
                    )
                } else {
                    return <Json of={type} />
                }
            } catch (e) {
                console.log(e)
                return JSON.stringify(type)
            }
        case "array":
            return (
                <>
                    <Type {...type.elementType} />
                    []
                </>
            )
        case "stringLiteral":
            return <code>{JSON.stringify(type.value)}</code>
        case "typeOperator":
            return "typeof " + type
    }
    console.error(type)
    return JSON.stringify(type)
    // throw new Error(type)
}

function Json({ of }: { of: any }) {
    return (
        <pre className="language-js">
            <code>{JSON.stringify(of, undefined, "  ")}</code>
        </pre>
    )
}

function Src(x: SourceReference) {
    return (
        <sub>
            <a href={"src/" + x.fileName + "#L" + x.line}>src</a>
        </sub>
    )
}
1

function Property({ of }: { of: JSONOutput.DeclarationReflection }) {
    return (
        <>
            <h4>
                {of.kindString.toLowerCase()} <code>{of.name}</code>
                {of.flags.isOptional && "?"}: <Type {...of.type} />
            </h4>
            <Comment of={of.comment} />
            {/* <Json of={of} /> */}
        </>
    )
}

const X: { [what: string]: React.ComponentType<any> } = {
    Comment,
    Typealias,
    Class,
    Method,
    Function: Method,
    Objectliteral,
    Property
}
function render(child: JSONOutput.Reflection, prefix: string): React.ReactNode {
    const n = child.kindString.replace(/\s+/g, "")
    const What = X[n] || Class
    if (child.flags && child.flags.isPrivate) {
        return undefined
    }
    if (child.comment?.tags?.some(tag => tag.tag === "internal")) {
        return undefined
    }
    if (!child.flags.isExported && !["Interface", "Class"].includes(child.kindString)) {
        return undefined
    }
    if (!What) throw new Error(child.kindString)
    return What && <What key={child.name} of={child} prefix={prefix} />
}
function reactJoin(x: React.ReactNode[], joiner: React.ReactNode = ", ") {
    const result: React.ReactNode[] = []
    x.forEach((x, i) => result.push(...(0 == i ? [x] : [joiner, x])))
    return <>{result}</>
}
// render twice to resolve references
const html1 = ReactDOMServer.renderToStaticMarkup(<DocPage docJson={docjson} />)
const idToHrefMap: Map<number, string> = new Map()
let match
const regex = /<h\d id="typedoc-id-(\d+)">(.*?)<\/h\d>/g
while ((match = regex.exec(html1))) {
    console.log("match", match[1])
    // see https://github.com/jch/html-pipeline/blob/master/lib/html/pipeline/toc_filter.rb
    const PUNCTUATION_REGEXP = /[^\w\- ]/g
    const [, id, h] = match

    const href =
        "#" +
        unescape(
            unescape(
                h
                    .toLowerCase()
                    .replace(/<.*?>/g, "") // remove tags
                    .replace(/\s+/g, " ")
            )
        )
            .trim()
            .replace(PUNCTUATION_REGEXP, "")
            .replace(/ /g, "-")
    !idToHrefMap.has(+id) && idToHrefMap.set(+id, href)
}

const htmlWithGfmLinks = html1.replace(/href="typedoc-id-(\d+)"/g, (m, id) => {
    const href = idToHrefMap.get(+id)
    if (!href) {
        console.warn("did not find href for typedoc-id-" + id)
        return m
    }
    return 'href="' + href + '"'
})
const md = turndownService.turndown(htmlWithGfmLinks)
const mdFileName = "README.md"
const prevReadme = fs.readFileSync(mdFileName, "utf8")
const findRegex = /<!-- START API AUTOGEN -->[\s\S]*?<!-- END API AUTOGEN -->/m
if (!findRegex.test(prevReadme)) {
    throw new Error("DID NOT FIND THINGS IN README")
}
const newReadme = prevReadme.replace(
    findRegex,
    "<!-- START API AUTOGEN -->\n" +
        "<!-- THIS SECTION WAS AUTOGENERATED BY gendoc.tsx! DO NOT EDIT! -->\n" +
        md +
        "<!-- END API AUTOGEN -->"
)

fs.writeFileSync(mdFileName, newReadme, "utf8")
fs.writeFileSync("out/README.html", htmlWithGfmLinks, "utf8")
