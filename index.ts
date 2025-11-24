const PORT = Number(process.env.PORT || 8080);

Bun.serve({
	port: PORT,

	async fetch(req) {
		const url = new URL(req.url);

		// remove the leading slash
		const forwardPath = url.pathname.slice(1);

		// make a target url
		let target: URL;
		try {
			target = new URL(forwardPath);
		} catch {
			return new Response("Invalid target path.", { status: 400 });
		}

		// clone headesr and remove problematic ones
		const headers = new Headers(req.headers);
		const hopByHop = [
			"host",
			"content-length",
			"transfer-encoding",
			"connection",
			"keep-alive",
			"proxy-authenticate",
			"proxy-authorization",
			"te",
			"trailer",
			"upgrade",
		];
		for (const h of hopByHop) headers.delete(h);

		// copy request body(if neccesary)
		const body =
			req.method === "GET" || req.method === "HEAD"
				? undefined
				: await req.arrayBuffer();

		let upstream: Response;
		try {
			upstream = await fetch(target, {
				method: req.method,
				headers,
				body,
				redirect: "manual",
			});
		} catch (err) {
			return new Response("Upstream fetch failed: " + String(err), { status: 502 });
		}

    // prepare response headers
		const out = new Headers();
		upstream.headers.forEach((value, key) => {
			// removes problematic headers
			const blocked = [
				"transfer-encoding",
				"content-encoding",
				"content-security-policy",
				"x-content-security-policy",
				"x-webkit-csp",
			];
			if (!blocked.includes(key.toLowerCase())) {
				out.set(key, value);
			}
		});

		// return response
		return new Response(upstream.body, {
			status: upstream.status,
			headers: out,
		});
	},
});

console.log(`Proxy running on http://localhost:${PORT}`);
