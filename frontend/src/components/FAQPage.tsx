import { useState } from 'react'
import { MessageCircle, Terminal, HardDrive, ChevronDown, ChevronUp } from 'lucide-react'

const faqSections = [
  {
    id: 'telegram',
    icon: <MessageCircle className="h-5 w-5 text-sky-400" />,
    title: 'Telegram Bot',
    variables: [
      {
        key: 'bot_token',
        name: 'Bot Token',
        description: 'Токен вашего Telegram-бота, полученный от @BotFather.',
        howToGet: [
          'Откройте Telegram и найдите бота @BotFather',
          'Отправьте команду /newbot',
          'Следуйте инструкциям — задайте имя и username боту',
          'BotFather выдаст токен вида: 1234567890:ABCdefGHIjklmNOPqrSTUvwXYZ',
          'Скопируйте токен в поле Bot Token',
        ],
      },
    ],
  },
  {
    id: 'termix',
    icon: <Terminal className="h-5 w-5 text-amber-400" />,
    title: 'Termix',
    variables: [
      {
        key: 'url',
        name: 'URL',
        description: 'Адрес вашего сервера Termix (без пути, только хост).',
        howToGet: [
          'Откройте Termix в браузере',
          'Скопируйте URL из адресной строки, например: https://termix.example.com',
          'Вставьте базовый URL в поле URL (без /users/login и т.д.)',
        ],
      },
      {
        key: 'username',
        name: 'Логин',
        description: 'Имя пользователя для входа в Termix.',
        howToGet: [
          'Откройте Termix → Настройки → Пользователи',
          'Используйте логин администратора или создайте нового пользователя',
        ],
      },
      {
        key: 'password',
        name: 'Пароль',
        description: 'Пароль для входа в Termix.',
        howToGet: [
          'Используйте пароль от аккаунта Termix',
          'Если забыли пароль — сбросьте через интерфейс Termix',
        ],
      },
    ],
  },
  {
    id: 'google_drive',
    icon: <HardDrive className="h-5 w-5 text-blue-400" />,
    title: 'Google Drive',
    variables: [
      {
        key: 'script_url',
        name: 'Script URL',
        description: 'URL развёрнутого Google Apps Script веб-приложения.',
        howToGet: [
          'Перейдите на script.google.com',
          'Создайте новый проект и вставьте код из инструкции ниже',
          'Нажмите "Начать развёртывание" → "Новое развёртывание"',
          'Выберите тип "Веб-приложение"',
          '"Выполнять как": Я | "У кого есть доступ": Все',
          'После развёртывания скопируйте URL вида: https://script.google.com/macros/s/.../exec',
        ],
        code: `function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const folderId = data.folderId;
    const fileId = data.fileId;
    const name = data.name;
    const content = data.content;

    let result;

    switch (action) {
      case 'create':
        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(name, content);
        result = { success: true, fileId: file.getId() };
        break;

      case 'update':
        const fileToUpdate = DriveApp.getFileById(fileId);
        fileToUpdate.setContent(content);
        if (name) fileToUpdate.setName(name);
        result = { success: true };
        break;

      case 'delete':
        DriveApp.getFileById(fileId).setTrashed(true);
        result = { success: true };
        break;

      default:
        result = { success: false, error: 'Unknown action' };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`,
      },
      {
        key: 'folder_id',
        name: 'Folder ID',
        description: 'Идентификатор папки в Google Drive, куда будут сохраняться файлы.',
        howToGet: [
          'Откройте Google Drive и создайте (или выберите) папку',
          'Откройте папку — ID находится в URL: https://drive.google.com/drive/folders/1scJArwHhUbfbkUEasr50GR6dO0kSJX4G',
          'ID — это последняя часть URL после последнего /',
          'Пример: Folder ID = 1scJArwHhUbfbkUEasr50GR6dO0kSJX4G',
        ],
      },
    ],
  },
]

interface AccordionItemProps {
  title: string
  description: string
  steps: string[]
  code?: string
}

function AccordionItem({ title, description, steps, code }: AccordionItemProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        <div>
          <h4 className="text-sm font-medium">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/50">
          <ol className="mt-3 space-y-1.5">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          {code && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Код для Google Apps Script:</p>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto text-muted-foreground">
                <code>{code}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function FAQPage() {
  const [openSection, setOpenSection] = useState<string | null>(null)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-semibold">FAQ</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Инструкции по настройке интеграций
        </p>
      </div>

      {faqSections.map((section) => (
        <div key={section.id} className="space-y-2">
          <button
            onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
            className="flex items-center gap-2 text-lg font-medium"
          >
            {section.icon}
            <span>{section.title}</span>
            {openSection === section.id ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {openSection === section.id && (
            <div className="space-y-2 pl-7">
              {section.variables.map((variable) => (
                <AccordionItem
                  key={variable.key}
                  title={variable.name}
                  description={variable.description}
                  steps={variable.howToGet}
                  code={variable.code}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}