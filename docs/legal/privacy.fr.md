# Politique de confidentialité — Fatorati (hors ligne)

**Dernière mise à jour : [LAST UPDATED]** · Cette politique décrit l'application
Android **Fatorati** (`com.fatorati.app`). Ceci est le texte français ; il est
identique sur le fond à [`privacy.en.md`](privacy.en.md) et
[`privacy.ar.md`](privacy.ar.md), et reprend le texte de référence
[`PRIVACY.md`](../../PRIVACY.md). Hébergez l'un de ces fichiers à une URL publique
pour la fiche du magasin d'applications.

## Résumé

Fatorati est un gestionnaire de facturation et de petite entreprise qui fonctionne
**hors ligne**. **Nous ne collectons, ne transmettons, ne vendons ni ne partageons
aucune donnée personnelle. Il n'y a ni compte, ni analytique, ni publicité, ni
traçage.** L'application est compilée sans la permission Android `INTERNET` : elle
ne peut donc ouvrir aucune connexion réseau — ni pour les mises à jour, ni pour
les polices, ni pour les rapports de plantage. La Content-Security-Policy
embarquée est `connect-src 'none'`, ce qui empêche également toute requête depuis
la couche web.

## Ce qui est stocké, et où

Tout ce que vous saisissez (informations de l'entreprise, clients, projets,
factures, devis, dépenses, produits, abonnements, idées, notes, tâches, réglages) est
stocké **uniquement sur votre appareil**, dans l'espace privé de l'application
(IndexedDB), chiffré en AES-256-GCM. La clé de chiffrement est dérivée du code PIN
à 6 chiffres que vous créez, via PBKDF2-SHA256 (600 000 itérations, sel aléatoire).
Le PIN n'est jamais conservé comme clé ni comme mot de passe : seul un vérificateur
est enregistré, donc un PIN oublié ne peut pas être récupéré.

Si vous activez le déverrouillage biométrique, une copie de la clé de chiffrement
est conservée dans le stockage d'identifiants adossé au Keystore Android, et ne
peut être libérée qu'après une authentification biométrique réussie.

Le seul autre stockage local est une configuration d'affichage non secrète
(langue, thème, couleur d'accent, format de date/heure, fuseau horaire, premier
jour de la semaine, chiffres, espacement, délai de verrouillage automatique, état
de la protection contre les captures d'écran, date de la dernière sauvegarde)
conservée dans `SharedPreferences`/`localStorage` pour que l'application s'affiche
correctement avant le déverrouillage.

## Ce qui apparaît à l'écran quand vous quittez l'application

Les captures d'écran et les aperçus d'applications récentes sont **bloqués par
défaut** via `FLAG_SECURE` d'Android : le contenu de l'application n'apparaît donc
pas dans la vignette des applications récentes ni dans un enregistrement d'écran.
Vous pouvez désactiver cette protection dans Réglages → Sécurité ; le choix est
stocké localement et s'applique immédiatement.

## Données collectées

**Aucune.** Nous n'exploitons aucun serveur recevant vos données, et l'application
ne comporte aucun chemin de code qui envoie des données où que ce soit. Nous
n'utilisons aucun SDK tiers d'analytique, de rapport de plantage, de publicité ou
d'attribution.

## Partage et exports

Le partage est toujours une action explicite de votre part :

- **L'export de sauvegarde** écrit un fichier `.fatorati` chiffré (AES-256-GCM avec
  un mot de passe que vous choisissez) dans le cache de l'application et le remet
  au partage Android. C'est vous qui décidez quelle application le reçoit.
- **Les exports CSV, PDF et Excel** sont écrits de la même manière.

**Les fichiers exportés ne sont pas chiffrés** (à l'exception de la sauvegarde
`.fatorati`). Toute personne ayant accès au fichier — ou à l'application ou au
service auquel vous l'envoyez — peut lire les factures, les clients et les
abonnements qu'il contient. L'application vous le rappelle sur chaque écran
d'export ; supprimez les fichiers exportés lorsque vous n'en avez plus besoin. Les
copies intermédiaires restent dans le cache privé de l'application et sont
supprimées au démarrage suivant, après chaque déverrouillage, ou depuis
Réglages → Sécurité → « Effacer les fichiers temporaires ».

- **Le sélecteur de fichiers Android** sert à importer une sauvegarde que vous
  choisissez.

Une fois qu'un fichier quitte l'application via le partage, l'application ou le
service destinataire applique sa propre politique de confidentialité — l'envoyer
par e-mail ou vers un espace cloud l'envoie à ce fournisseur. L'application
elle-même ne téléverse jamais rien.

## Conservation et suppression

Vos données restent jusqu'à ce que vous les supprimiez. **Désinstaller
l'application supprime tous les enregistrements et la clé de chiffrement** : il
n'existe aucune copie distante et aucune récupération sans un fichier de
sauvegarde que vous avez exporté vous-même. La sauvegarde automatique Android et
le transfert d'appareil à appareil sont désactivés pour cette application
(`allowBackup=false`, `fullBackupContent=false` et exclusions `dataExtractionRules`
explicites pour tous les domaines) : votre coffre n'est donc pas copié dans Google
Drive par le système.

- Réglages → Sécurité → **Réinitialiser l'application** supprime tous les
  enregistrements, le vérificateur de PIN, les identifiants biométriques, les
  préférences et les fichiers d'export en cache, après deux confirmations.
- **Effacer les fichiers temporaires** (Réglages → Sécurité) supprime les fichiers
  d'export du cache. L'application les efface aussi automatiquement au démarrage
  et après chaque déverrouillage.

## Rappels du carnet et du calendrier

Les notes, les tâches et le calendrier vivent dans le même coffre chiffré que le
reste des enregistrements, et ne voyagent que dans la sauvegarde chiffrée
`.fatorati`. Un rappel est une notification Android locale : il ne quitte jamais
l'appareil. Par défaut son texte est générique (« Note reminder »), donc aucun
contenu de note n'apparaît sur l'écran de verrouillage ni dans le volet de
notifications ; l'application laisse aussi « Masquer les noms de services dans les
notifications » activé. Les notifications sont approximatives, l'application ne
demande jamais la permission d'alarme exacte, et refuser la permission de
notification signifie seulement que les rappels restent silencieux et que
l'application affiche une bannière interne.

## Permissions

Voici la liste complète des permissions embarquées. Elle est vérifiée par
l'intégration continue, qui échoue si le manifeste Android fusionné contient autre
chose (`Verify the merged release manifest permissions` dans
`.github/workflows/android-apk.yml`).

| Permission | Pourquoi elle est présente |
|---|---|
| `android.permission.POST_NOTIFICATIONS` | Rappels d'abonnement facultatifs. Demandée uniquement lorsque vous activez les rappels dans les réglages, jamais au démarrage. |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Permet au plugin de notifications de restaurer vos rappels en attente après un redémarrage du téléphone. Elle ne sert à rien démarrer toute seule. |
| `android.permission.WAKE_LOCK` | Permet au plugin de notifications de réveiller brièvement l'appareil pour afficher un rappel que vous avez programmé. |
| `android.permission.USE_BIOMETRIC` | Déverrouillage biométrique facultatif (actif seulement si vous l'activez). |
| `android.permission.USE_FINGERPRINT` | Déclarée par la bibliothèque AndroidX Biometric utilisée pour ce même déverrouillage facultatif. Elle est obsolète sur Android moderne et l'application ne lit aucune donnée d'empreinte. |
| `com.fatorati.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Permission de niveau signature déclarée par l'outil de compilation Android pour les récepteurs internes (non exportés) de l'application. Elle ne donne aucun droit à des tiers et ne vous est jamais demandée. |

**Non demandées :** pas d'`INTERNET`, pas de
`READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` ni `MANAGE_EXTERNAL_STORAGE`, pas
de `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` (le plugin de notifications déclare la
permission d'alarme exacte et l'application la retire avec `tools:node="remove"`,
car les rappels sont volontairement inexacts), pas de permission de localisation,
caméra, microphone, contacts, SMS, journal d'appels, calendrier, activité physique
ni identifiant publicitaire.

Le partage de fichiers passe par un `FileProvider` limité au dossier d'export de
l'application, et non par des permissions de stockage : aucun accès au stockage
n'est donc nécessaire.

## Enfants

L'application est un outil professionnel et ne s'adresse pas aux enfants. Elle ne
collecte aucune donnée personnelle, de qui que ce soit.

## Notes pour les fiches de magasin

Pour le formulaire « Sécurité des données » de Google Play, les réponses exactes
sont : *aucune donnée collectée*, *aucune donnée partagée*, données *chiffrées en
transit* — sans objet (aucune transmission), suppression possible — *sans objet,
les données ne quittent jamais l'appareil et la désinstallation les efface*.

## Modifications

Si cette politique change, la nouvelle version sera publiée dans ce fichier, dans
`PRIVACY.md` et dans les notes de version. Comme l'application ne peut rien
télécharger depuis le réseau, une copie de cette politique est aussi livrée avec
le code source de l'application.

## Contact

Questions ou demandes : **[SUPPORT EMAIL]** (publiée avec la fiche de
l'application).
