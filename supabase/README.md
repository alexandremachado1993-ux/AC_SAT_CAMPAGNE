# Base de données (Supabase)

`migrations/` est le **miroir exact** de l'historique appliqué à la base du projet (`supabase_migrations.schema_migrations`) :
**mêmes versions, mêmes noms**, 7 fichiers. L'intégration GitHub de Supabase compare les deux ; au moindre écart elle échoue avec
« Remote migration versions not found in local migrations directory » (c'est ce qui s'est produit le 2 octobre 2026).

## Règles
1. **Une migration appliquée à la base = un fichier ici, avec la version EXACTE de la base** (`select version, name from supabase_migrations.schema_migrations`),
   sous la forme `<14 chiffres>_<nom_en_snake_case>.sql`. Ne jamais renommer un fichier existant.
2. **Aucun secret dans ce dépôt, qui est public.** La migration `20260928075856_notifications_push.sql` a inséré, dans `prive.config`, la clé privée VAPID
   et le secret de la tâche planifiée : ici elles sont remplacées par `A_RENSEIGNER__CLE_PRIVEE_VAPID` et `A_RENSEIGNER__SECRET_ALEATOIRE`. Les vraies valeurs
   vivent uniquement dans la table `prive.config` de la base et dans les secrets de la fonction `rappels`. Ne jamais les recopier ici : `Tests/test50.js` échoue si
   une vraie valeur apparaît. (Rejouer ce fichier sur une base vierge demande donc de renseigner ces deux valeurs.)
3. La fonction serveur est dans `functions/rappels/` (déployée séparément ; `verify_jwt` doit rester à `false`).
