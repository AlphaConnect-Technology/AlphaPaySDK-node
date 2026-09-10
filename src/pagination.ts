import type { Http } from "./http.js";
import type { CursorPaginatedList, PaginatedList } from "./types.js";

type AnyPage<T> = PaginatedList<T> | CursorPaginatedList<T>;

/**
 * Parcourt automatiquement toutes les pages d'une ressource paginée,
 * qu'elle soit paginée par page (`PaginatedList`, avec `count`) ou par
 * curseur (`CursorPaginatedList`, sans `count` — ex. `transactions.list()`).
 *
 * Suit le lien `next` renvoyé TEL QUEL par l'API plutôt que de recalculer un
 * numéro de page soi-même : un curseur n'est pas un numéro de page (c'est un
 * jeton opaque encodant une position dans le tri), l'incrémenter à la main
 * ne ferait qu'interroger indéfiniment la même première page.
 *
 * @param http `client.http` — nécessaire pour requêter l'URL absolue `next`.
 * @param firstPage Le premier appel déjà lancé, ex. `client.transactions.list({ status: "SUCCESS" })`.
 *
 * @example
 * for await (const tx of paginate(alphapay.http, alphapay.transactions.list({ status: "SUCCESS" }))) {
 *   console.log(tx.reference);
 * }
 */
export async function* paginate<T>(http: Http, firstPage: Promise<AnyPage<T>>): AsyncGenerator<T, void, undefined> {
  let page: AnyPage<T> | null = await firstPage;
  while (page) {
    for (const item of page.results) yield item;
    page = page.next ? await http.request<AnyPage<T>>("GET", page.next) : null;
  }
}
