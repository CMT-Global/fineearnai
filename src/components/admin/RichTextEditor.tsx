import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough, 
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  Unlink,
  RemoveFormatting
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  tooltip: string;
}

const ToolbarButton = ({ onClick, isActive, disabled, icon, tooltip }: ToolbarButtonProps) => (
  <TooltipProvider delayDuration={300}>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "h-9 w-9 p-0 touch-manipulation",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring",
            isActive && "bg-accent text-accent-foreground"
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export const RichTextEditor = ({
  value,
  onChange,
  placeholder = "Start typing...",
  maxLength = 5000,
  className,
  disabled = false,
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
  });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL:', previousUrl);

    // Cancelled
    if (url === null) return;

    // Empty - remove link
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    // Update link
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const clearFormatting = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  const characterCount = editor.state.doc.textContent.length;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={cn("border rounded-lg bg-background", className)}>
      {/* Toolbar */}
      <div className="border-b bg-muted/30 p-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max flex-wrap sm:flex-nowrap">
          {/* Text Formatting */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              disabled={disabled}
              icon={<Bold className="h-4 w-4" />}
              tooltip="Bold (Ctrl+B)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              disabled={disabled}
              icon={<Italic className="h-4 w-4" />}
              tooltip="Italic (Ctrl+I)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              isActive={editor.isActive('underline')}
              disabled={disabled}
              icon={<UnderlineIcon className="h-4 w-4" />}
              tooltip="Underline (Ctrl+U)"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive('strike')}
              disabled={disabled}
              icon={<Strikethrough className="h-4 w-4" />}
              tooltip="Strikethrough"
            />
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Headings */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              disabled={disabled}
              icon={<Heading1 className="h-4 w-4" />}
              tooltip="Heading 1"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              disabled={disabled}
              icon={<Heading2 className="h-4 w-4" />}
              tooltip="Heading 2"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              disabled={disabled}
              icon={<Heading3 className="h-4 w-4" />}
              tooltip="Heading 3"
            />
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Lists */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              disabled={disabled}
              icon={<List className="h-4 w-4" />}
              tooltip="Bullet List"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              disabled={disabled}
              icon={<ListOrdered className="h-4 w-4" />}
              tooltip="Numbered List"
            />
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Alignment */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              isActive={editor.isActive({ textAlign: 'left' })}
              disabled={disabled}
              icon={<AlignLeft className="h-4 w-4" />}
              tooltip="Align Left"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              isActive={editor.isActive({ textAlign: 'center' })}
              disabled={disabled}
              icon={<AlignCenter className="h-4 w-4" />}
              tooltip="Align Center"
            />
            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              isActive={editor.isActive({ textAlign: 'right' })}
              disabled={disabled}
              icon={<AlignRight className="h-4 w-4" />}
              tooltip="Align Right"
            />
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Links */}
          <div className="flex items-center gap-1">
            <ToolbarButton
              onClick={setLink}
              isActive={editor.isActive('link')}
              disabled={disabled}
              icon={<Link2 className="h-4 w-4" />}
              tooltip="Add Link"
            />
            <ToolbarButton
              onClick={removeLink}
              disabled={disabled || !editor.isActive('link')}
              icon={<Unlink className="h-4 w-4" />}
              tooltip="Remove Link"
            />
          </div>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Clear Formatting */}
          <ToolbarButton
            onClick={clearFormatting}
            disabled={disabled}
            icon={<RemoveFormatting className="h-4 w-4" />}
            tooltip="Clear Formatting"
          />
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative">
        <EditorContent
          editor={editor}
          className={cn(
            "prose prose-sm sm:prose-base max-w-none p-4 focus:outline-none min-h-[300px] max-h-[500px] overflow-y-auto",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      </div>

      {/* Character Counter */}
      <div className="border-t p-2 flex items-center justify-between bg-muted/20">
        <p className="text-xs text-muted-foreground">
          Use the toolbar above to format your message
        </p>
        <p
          className={cn(
            "text-xs font-medium",
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {characterCount}{maxLength && ` / ${maxLength}`}
        </p>
      </div>
    </div>
  );
};
