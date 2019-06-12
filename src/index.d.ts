/// <reference types="RpcEngine" />

declare namespace RpcEngine {

	/** A String specifying the version of the JSON-RPC protocol. MUST be exactly "2.0". */
	export type JsonRpcVersion = "2.0";

	/** Method names that begin with the word rpc followed by a period character 
	 * (U+002E or ASCII 46) are reserved for rpc-internal methods and extensions
	 *  and MUST NOT be used for anything else. */
	export type JsonRpcReservedMethod = string;

	/** An identifier established by the Client that MUST contain a String, Number,
	 *  or NULL value if included. If it is not included it is assumed to be a 
	 *  notification. The value SHOULD normally not be Null and Numbers SHOULD
	 *  NOT contain fractional parts [2] */
	export type JsonRpcId = number | string | void;

	interface JsonRpcRequest<T> {
		jsonrpc: JsonRpcVersion;
		id: JsonRpcId;
		params?: T; 
	}

	interface JsonRpcNotification<T> extends JsonRpcResponse<T> {
		jsonrpc: JsonRpcVersion;
		params?: T; 
	}

	interface JsonRpcResponse<T> {
		jsonrpc: JsonRpcVersion;
		id: JsonRpcId;
	}

	interface JsonRpcSuccess<T> extends JsonRpcResponse<T> {
			result: T;
	}

	interface JsonRpcFailure<T> extends JsonRpcResponse<T> {
			error: JsonRpcError<T>;
	}

	interface JsonRpcError<T> {
		/** Must be an integer */
		code: number;
		message: string;
		data?: T;
	}

	type JsonRpcEngineEndCallback = (error?: JsonRpcError<any>) => void;

	interface JsonRpcMiddleware {
		(
			req: JsonRpcRequest<any[]>,
			res: JsonRpcResponse<any[]>,
			next: (returnFlightCallback?: (res: JsonRpcResponse<any>) => void) => void,
			end: JsonRpcEngineEndCallback,
		) : void;
	}

	interface RpcEngine {
		push: (middleware: JsonRpcMiddleware) => void;
		handle: (req: JsonRpcRequest, cb: (err: JsonRpcError?, res: JsonRpcResponse) => void) => void;
		
	}

}
