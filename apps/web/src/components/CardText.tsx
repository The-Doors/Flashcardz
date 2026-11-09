const INLINE_MARKDOWN = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

function renderInline(text: string) {
  return text.split(INLINE_MARKDOWN).map((part, index) => {
    if (part.length > 2 && part.startsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.length > 4 && part.startsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/** Renders the Markdown the card editor's toolbar can insert: bold, italic, code and lists. */
export default function CardText({ text }: { text: string }) {
  const blocks: (string | string[])[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("- ")) {
      const previous = blocks.at(-1);
      if (Array.isArray(previous)) previous.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else if (line.trim()) {
      blocks.push(line);
    }
  }

  return (
    <div className="sp-text">
      {blocks.map((block, index) =>
        Array.isArray(block) ? (
          <ul key={index}>
            {block.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{renderInline(block)}</p>
        ),
      )}
    </div>
  );
}
