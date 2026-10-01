import {
  Button,
  Drawer,
  Input,
  Label,
  RadioGroup,
  Select,
  Text,
  toast,
} from '@medusajs/ui';
import { useState } from 'react';

import { useSaveEmailProvider } from '../../hooks/use-email-provider';
import { getApiErrorMessage } from '../../lib/api-error';
import type {
  CredentialInput,
  CredentialSource,
  EmailProviderTransportState,
} from '../../lib/types';

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const ENTERABLE_SOURCES: CredentialSource[] = [
  'environment',
  'encrypted_database',
];

type TransportDrawerProps = {
  transport: EmailProviderTransportState;
  encryptionAvailable: boolean;
  onClose: () => void;
};

const TransportDrawer = ({
  transport,
  encryptionAvailable,
  onClose,
}: TransportDrawerProps) => {
  const saveProvider = useSaveEmailProvider();

  const [fromAddress, setFromAddress] = useState(
    asString(transport.config.from_address),
  );
  const [replyTo, setReplyTo] = useState(asString(transport.config.reply_to));
  const [domain, setDomain] = useState(asString(transport.config.domain));
  const [region, setRegion] = useState(
    asString(transport.config.region) || 'us',
  );
  const [source, setSource] = useState<CredentialSource>(
    transport.credential?.source ??
      transport.credential_sources.find((it) =>
        ENTERABLE_SOURCES.includes(it),
      ) ??
      'environment',
  );
  const [envVarName, setEnvVarName] = useState(
    transport.credential?.env_var_name ?? '',
  );
  const [apiKey, setApiKey] = useState('');

  const isMailgun = transport.id === 'mailgun';
  const isCloud = transport.credential_sources.includes('managed');
  const sources = transport.credential_sources.filter((it) =>
    ENTERABLE_SOURCES.includes(it),
  );

  const buildConfig = (): Record<string, unknown> => {
    if (isCloud) {
      return {};
    }

    return {
      from_address: fromAddress,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(isMailgun ? { domain, region } : {}),
    };
  };

  const buildCredential = (): CredentialInput | undefined => {
    if (!sources.length) {
      return undefined;
    }

    if (source === 'environment') {
      return { source: 'environment', env_var_name: envVarName };
    }

    return {
      source: 'encrypted_database',
      ...(apiKey ? { api_key: apiKey } : {}),
    };
  };

  const save = () => {
    saveProvider.mutate(
      {
        transport_id: transport.id,
        config: buildConfig(),
        credential: buildCredential(),
      },
      {
        onSuccess: () => {
          toast.success(
            transport.selected
              ? `${transport.label} updated.`
              : `${transport.label} now sends email.`,
          );
          onClose();
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title className="font-medium">{transport.label}</Drawer.Title>
          <Drawer.Description>
            {isCloud
              ? 'Managed by your Medusa Cloud project.'
              : 'Sender address and API credential.'}
          </Drawer.Description>
        </Drawer.Header>

        <Drawer.Body className="flex flex-col gap-y-6 overflow-y-auto">
          {isCloud ? (
            <Text size="small" className="text-ui-fg-subtle">
              Nothing to enter. This transport forwards the whole notification
              envelope to the Cloud email service using the configuration
              already injected into this backend. Because the plugin owns the
              email channel, Medusa&apos;s automatic Cloud provider registration
              does not run.
            </Text>
          ) : (
            <div className="flex flex-col gap-y-4">
              {isMailgun && (
                <>
                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus" htmlFor="mg-domain">
                      Sending domain
                    </Label>
                    <Input
                      id="mg-domain"
                      value={domain}
                      onChange={(event) => setDomain(event.target.value)}
                      placeholder="mg.example.com"
                    />
                  </div>

                  <div className="flex flex-col gap-y-2">
                    <Label size="small" weight="plus" htmlFor="mg-region">
                      Region
                    </Label>
                    <Select value={region} onValueChange={setRegion}>
                      <Select.Trigger id="mg-region">
                        <Select.Value placeholder="Select a region" />
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="us">
                          US — api.mailgun.net
                        </Select.Item>
                        <Select.Item value="eu">
                          EU — api.eu.mailgun.net
                        </Select.Item>
                      </Select.Content>
                    </Select>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Must match where the domain was created.
                    </Text>
                  </div>
                </>
              )}

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus" htmlFor="from-address">
                  From address
                </Label>
                <Input
                  id="from-address"
                  value={fromAddress}
                  onChange={(event) => setFromAddress(event.target.value)}
                  placeholder="orders@example.com"
                />
              </div>

              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus" htmlFor="reply-to">
                  Reply-to
                </Label>
                <Input
                  id="reply-to"
                  value={replyTo}
                  onChange={(event) => setReplyTo(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          )}

          {sources.length > 0 && (
            <div className="flex flex-col gap-y-3">
              <Text size="small" weight="plus">
                Credential
              </Text>

              <RadioGroup
                value={source}
                onValueChange={(value) => setSource(value as CredentialSource)}
              >
                {sources.includes('environment') && (
                  <RadioGroup.ChoiceBox
                    value="environment"
                    label="Environment variable"
                    description="Read from the server at send time."
                  />
                )}
                {sources.includes('encrypted_database') && (
                  <RadioGroup.ChoiceBox
                    value="encrypted_database"
                    label="Stored API key"
                    description={
                      encryptionAvailable
                        ? 'Encrypted with AES-256-GCM.'
                        : 'Needs MEDUSA_EMAIL_ENCRYPTION_KEY on the server.'
                    }
                    disabled={!encryptionAvailable}
                  />
                )}
              </RadioGroup>

              {source === 'environment' ? (
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus" htmlFor="env-var-name">
                    Variable name
                  </Label>
                  <Input
                    id="env-var-name"
                    value={envVarName}
                    onChange={(event) => setEnvVarName(event.target.value)}
                    placeholder="RESEND_API_KEY"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus" htmlFor="api-key">
                    API key
                  </Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Configured — leave blank to keep"
                  />
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Stored encrypted. The admin API never returns the key.
                  </Text>
                </div>
              )}
            </div>
          )}
        </Drawer.Body>

        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">
              Cancel
            </Button>
          </Drawer.Close>
          {!isCloud && (
            <Button
              size="small"
              disabled={saveProvider.isPending}
              onClick={save}
            >
              {transport.selected ? 'Save' : 'Save & activate'}
            </Button>
          )}
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export default TransportDrawer;
