"use client"

import { useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { exportDataUrl } from "@/hooks/use-data-import"
import { usePageTitle } from "@rms/ui/use-page-title"
import { dataImportDomainConfigs } from "./domain-configs"
import { ImportWizardDialog } from "./import-wizard-dialog"
import { JobHistoryTable } from "./job-history-table"

export default function DataImportPage() {
  usePageTitle("Data Import")
  const [domain, setDomain] = useState(dataImportDomainConfigs[0]!.domain)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Data Import</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-import historical or legacy data as CSV/Excel. Superadmin only.
        </p>
      </div>

      <Tabs value={domain} onValueChange={(value) => value && setDomain(value)}>
        <TabsList>
          {dataImportDomainConfigs.map((config) => (
            <TabsTrigger key={config.domain} value={config.domain}>
              {config.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {dataImportDomainConfigs.map((config) => (
          <TabsContent key={config.domain} value={config.domain} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Import {config.label.toLowerCase()} from a spreadsheet.</p>
              <div className="flex items-center gap-2">
                <a href={exportDataUrl(config.domain)} download className={buttonVariants({ variant: "outline" })}>
                  Export {config.label.toLowerCase()}
                </a>
                <ImportWizardDialog config={config} />
              </div>
            </div>
            <JobHistoryTable domain={config.domain} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
