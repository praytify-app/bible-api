import { BookOpen, KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  CodeBlock,
  ConfirmDialog,
  CopyButton,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Eyebrow,
  Field,
  IconButton,
  Input,
  Kbd,
  Logo,
  PageHeader,
  SearchSelect,
  Select,
  Skeleton,
  Spinner,
  Stat,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextArea,
  ThemeToggle,
  Tooltip,
} from "..";

// Sample data for the gallery only. Never imported by the app.
const versions = [
  { value: "WEB", label: "World English Bible", description: "English" },
  { value: "LSG", label: "Louis Segond 1910", description: "Français" },
  { value: "RVR09", label: "Reina-Valera 1909", description: "Español" },
  { value: "ARC", label: "Almeida Revista e Corrigida", description: "Português" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-hairline py-8">
      <h2 className="text-h3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Gallery({ open, focus }: { open: string | null; focus?: string | null }) {
  const [version, setVersion] = useState<string | null>("WEB");
  const [confirmOpen, setConfirmOpen] = useState(open === "confirm");
  const [dialogOpen, setDialogOpen] = useState(open === "dialog");
  const [notify, setNotify] = useState(true);

  return (
    <main className="mx-auto max-w-content px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Logo product />
        <ThemeToggle />
      </div>

      <div className="py-10">
        <PageHeader
          eyebrow="Design system"
          title="Read every word."
          serifLine="Build on the Word."
          description="Primitives for the Praytify Bible portal, in the Sacred Dawn palette."
          actions={<Button leadingIcon={<Plus />}>Primary action</Button>}
        />
      </div>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" leadingIcon={<Trash2 />}>
            Revoke
          </Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">
            Small
          </Button>
          <Button size="lg">Large</Button>
          <IconButton label="Search" icon={<Search />} variant="secondary" showTooltip />
          <Tooltip content="Keyboard shortcut: left and right arrows">
            <Button variant="ghost">Tooltip</Button>
          </Tooltip>
          <CopyButton value="pb_live_example" label="Copy key" />
          <CopyButton value="pb_live_example" label="Copy key" display="icon" />
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Key name" hint="Only you see this." required>
            <Input placeholder="Production web" />
          </Field>
          <Field label="Allowed origin" error="Use https://host or https://*.host">
            <Input defaultValue="http://example.com" />
          </Field>
          <Field label="Key type">
            <Select
              options={[
                { value: "secret", label: "Secret key" },
                { value: "publishable", label: "Publishable key" },
              ]}
              placeholder="Choose a type"
            />
          </Field>
          <Field label="Version">
            <SearchSelect options={versions} value={version} onValueChange={setVersion} />
          </Field>
          <Field label="Search" hideLabel>
            <Input type="search" leadingIcon={<Search />} placeholder="Search translations" />
          </Field>
          <Field label="Disabled" disabled>
            <Input defaultValue="Read only" />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <TextArea placeholder="What this key is for" />
          </Field>
          <div className="flex flex-col">
            <Checkbox label="Show verse numbers" defaultChecked description="Numbers sit in the margin." />
            <Checkbox label="Unchecked option" />
            <Checkbox label="Disabled option" disabled />
          </div>
          <div className="flex flex-col">
            <Switch label="Email me about usage" checked={notify} onCheckedChange={setNotify} />
            <Switch label="Disabled switch" disabled />
          </div>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="passage">
          <TabsList aria-label="Widget type">
            <TabsTrigger value="passage">Passage</TabsTrigger>
            <TabsTrigger value="daily">Daily verse</TabsTrigger>
          </TabsList>
          <TabsContent value="passage">Passage settings</TabsContent>
          <TabsContent value="daily">Daily verse settings</TabsContent>
        </Tabs>
        <Tabs defaultValue="overview">
          <TabsList variant="underline" aria-label="Sections">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="keys">API keys</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>
        </Tabs>
      </Section>

      <Section title="Alerts and badges">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Publishable keys need an origin" role="none">
            Add the site that will call the API.
          </Alert>
          <Alert tone="success" title="Key created" role="none">
            Copy it now. It will not be shown again.
          </Alert>
          <Alert tone="warning" title="Attribution off" role="none">
            Some licences require attribution.
          </Alert>
          <Alert tone="danger" title="Usage could not be loaded" role="none" onDismiss={() => {}}>
            The server did not respond. Try again.
          </Alert>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Publishable</Badge>
          <Badge tone="success">Active</Badge>
          <Badge tone="warning">Expires soon</Badge>
          <Badge tone="danger">Revoked</Badge>
          <Badge tone="info">Partner</Badge>
        </div>
      </Section>

      <Section title="Cards and stats">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <Stat label="Requests today" value={1288} hint="Since 00:00 UTC" />
          </Card>
          <Card>
            <Stat label="Errors" value={null} unavailableReason="Usage could not be loaded." />
          </Card>
          <Card>
            <Stat label="Active keys" value={3} loading />
          </Card>
        </div>
        <Card>
          <CardHeader
            title="API keys"
            description="Secret keys stay on your server. Publishable keys work from allowed origins."
            actions={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem icon={<KeyRound />}>Rename</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem icon={<Trash2 />} tone="danger">
                    Revoke
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />
          <Table caption="API keys" stackOnMobile>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Kind</TableHeaderCell>
                <TableHeaderCell>Prefix</TableHeaderCell>
                <TableHeaderCell>Last used</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell label="Name">Production web</TableCell>
                <TableCell label="Kind">
                  <Badge tone="accent">Publishable</Badge>
                </TableCell>
                <TableCell label="Prefix" className="font-mono">
                  pb_pub_a1b2
                </TableCell>
                <TableCell label="Last used">2 hours ago</TableCell>
              </TableRow>
              <TableRow>
                <TableCell label="Name">Server</TableCell>
                <TableCell label="Kind">
                  <Badge>Secret</Badge>
                </TableCell>
                <TableCell label="Prefix" className="font-mono">
                  pb_live_c3d4
                </TableCell>
                <TableCell label="Last used">Never</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        <Card variant="committed" padding="lg">
          <Eyebrow tone="muted" className="text-on-accent">
            Get started
          </Eyebrow>
          <p className="mt-3 font-serif text-h2 font-medium italic">Make your first call in a minute.</p>
          {/* On a committed panel the call to action is secondary (light), never primary indigo on indigo. */}
          <Button variant="secondary" className="mt-5" autoFocus={focus === "committed"}>
            Get an API key
          </Button>
        </Card>
      </Section>

      <Section title="Code">
        <CodeBlock
          tabs={[
            { label: "cURL", language: "bash", code: 'curl "https://api.praytify.bible/v1/verses?ref=JHN.3.16&version=WEB"' },
            { label: "JavaScript", language: "ts", code: 'const res = await fetch("https://api.praytify.bible/v1/daily");' },
          ]}
        />
        <CodeBlock language="html" label="HTML" code={'<praytify-verse ref="PSA.23.1-3"></praytify-verse>'} />
      </Section>

      <Section title="Feedback and type">
        <div className="flex flex-wrap items-center gap-6">
          <Spinner />
          <Skeleton className="h-4 w-40" />
          <span className="text-body-sm text-ink-secondary">
            Press <Kbd>←</Kbd> <Kbd>→</Kbd> to change chapter
          </span>
          <Eyebrow index="01">Why we built it</Eyebrow>
        </div>
        <p className="max-w-measure font-serif text-scripture">
          <sup className="mr-1 font-sans text-caption text-ink-muted">16</sup>
          <span className="bg-highlight">For God so loved the world, that he gave his one and only Son,</span> that whoever
          believes in him should not perish, but have eternal life.
        </p>
        <EmptyState
          icon={<BookOpen />}
          title="No API keys yet"
          description="Create a key to call the API from your app."
          action={<Button leadingIcon={<Plus />}>Create key</Button>}
        />
      </Section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          title="Create an API key"
          description="Choose secret for servers or publishable for browsers."
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button>Create key</Button>
            </>
          }
        >
          <Field label="Key name" required>
            <Input placeholder="Production web" />
          </Field>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Revoke this key?"
        subject="Production web (pb_pub_a1b2)"
        description="Sites using it will get 401 errors right away. This cannot be undone."
        confirmLabel="Revoke key"
        onConfirm={() => Promise.reject(new Error("The server did not respond."))}
        error={open === "confirm" ? "The server did not respond." : null}
      />
    </main>
  );
}
