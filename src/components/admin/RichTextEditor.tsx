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
  RemoveFormatting,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { wrapInProfessionalTemplate, extractContentFromTemplate, createStyledButton } from '@/lib/email-template-wrapper';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  enableProfessionalTemplate?: boolean;
  templateTitle?: string;
  onEditorReady?: (insertVariable: (variableName: string) => void) => void;
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
            "h-10 w-10 p-0 touch-manipulation flex-shrink-0", // Minimum 40px touch target
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring",
            "active:scale-95 transition-transform", // Visual feedback on tap
            isActive && "bg-accent text-accent-foreground"
          )}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs hidden sm:block">
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
  enableProfessionalTemplate = true,
  templateTitle = 'FineEarn',
  onEditorReady,
}: RichTextEditorProps) => {
  const [useProfessionalTemplate, setUseProfessionalTemplate] = useState(false);
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

  // Insert variable at cursor position
  const insertVariable = useCallback((variableName: string) => {
    if (!editor) return;
    const formattedVariable = `{{${variableName}}}`;
    editor.chain().focus().insertContent(formattedVariable + ' ').run();
  }, [editor]);

  // Expose insertVariable method to parent component
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(insertVariable);
    }
  }, [editor, onEditorReady, insertVariable]);

  // Handle professional template toggle
  const handleTemplateToggle = useCallback((checked: boolean) => {
    setUseProfessionalTemplate(checked);
    
    if (editor) {
      const currentContent = editor.getHTML();
      
      if (checked) {
        // Wrap current content in professional template
        const wrappedContent = wrapInProfessionalTemplate(currentContent, {
          title: templateTitle,
          headerGradient: true,
          includeFooter: true,
        });
        onChange(wrappedContent);
      } else {
        // Extract plain content from template
        const plainContent = extractContentFromTemplate(currentContent);
        editor.commands.setContent(plainContent);
        onChange(plainContent);
      }
    }
  }, [editor, onChange, templateTitle]);

  // Insert styled button
  const handleInsertButton = useCallback(() => {
    if (editor) {
      const buttonHtml = createStyledButton('Click Here', 'https://fineearn.com', 'primary');
      editor.commands.insertContent(buttonHtml);
      
      // Update the value with wrapped template if enabled
      const updatedContent = editor.getHTML();
      if (useProfessionalTemplate) {
        onChange(wrapInProfessionalTemplate(updatedContent, { title: templateTitle }));
      } else {
        onChange(updatedContent);
      }
    }
  }, [editor, onChange, useProfessionalTemplate, templateTitle]);

  if (!editor) {
    return null;
  }

  const characterCount = editor.state.doc.textContent.length;
  const isOverLimit = maxLength && characterCount > maxLength;

  return (
    <div className={cn("border rounded-lg bg-background", className)}>
      {/* Professional Template Toggle - Simplified */}
      {enableProfessionalTemplate && (
        <div className="border-b px-4 py-2.5 bg-muted/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="professional-template" className="text-xs font-normal cursor-pointer text-muted-foreground">
                Use professional email wrapper
              </Label>
            </div>
            <Switch
              id="professional-template"
              checked={useProfessionalTemplate}
              onCheckedChange={handleTemplateToggle}
              disabled={disabled}
            />
          </div>
        </div>
      )}
      
      {/* Toolbar - Improved Visual Grouping */}
      <div className="border-b bg-background sticky top-0 z-10">
        <div className="overflow-x-auto">
          <div className="flex items-center gap-0.5 min-w-max p-2.5">
            {/* Text Formatting Group */}
            <div className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/30">
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

            <Separator orientation="vertical" className="h-8 mx-2 bg-border" />

            {/* Headings Group */}
            <div className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/30">
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

            <Separator orientation="vertical" className="h-8 mx-2 bg-border" />

            {/* Lists Group */}
            <div className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/30">
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

            <Separator orientation="vertical" className="h-8 mx-2 bg-border" />

            {/* Alignment Group */}
            <div className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/30">
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

            <Separator orientation="vertical" className="h-8 mx-2 bg-border" />

            {/* Links Group */}
            <div className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/30">
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

            <Separator orientation="vertical" className="h-8 mx-2 bg-border" />

            {/* Utilities Group */}
            <div className="flex items-center gap-0.5 px-2 py-1 rounded-md bg-muted/30">
              <ToolbarButton
                onClick={clearFormatting}
                disabled={disabled}
                icon={<RemoveFormatting className="h-4 w-4" />}
                tooltip="Clear Formatting"
              />
              <ToolbarButton
                onClick={handleInsertButton}
                disabled={disabled}
                icon={<Sparkles className="h-4 w-4" />}
                tooltip="Insert Styled Button"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Editor Content - Enhanced Spacing & Focus States */}
      <div className="relative">
        <EditorContent
          editor={editor}
          className={cn(
            "prose prose-sm sm:prose-base max-w-none p-4 sm:p-6 focus-within:outline-none min-h-[350px] max-h-[550px] overflow-y-auto",
            "touch-manipulation transition-all duration-200",
            "focus-within:bg-muted/5",
            "[&_.ProseMirror]:min-h-[320px] [&_.ProseMirror]:focus:outline-none",
            "[&_.ProseMirror]:leading-relaxed",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/60",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:italic",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      </div>

      {/* Character Counter - Mobile Optimized */}
      <div className="border-t p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 bg-muted/20">
        <p className="text-xs text-muted-foreground hidden sm:block">
          Use the toolbar above to format your message
        </p>
        <p className="text-xs text-muted-foreground sm:hidden">
          Format with toolbar
        </p>
        <p
          className={cn(
            "text-xs font-medium tabular-nums",
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {characterCount}{maxLength && ` / ${maxLength}`}
        </p>
      </div>
    </div>
  );
};
